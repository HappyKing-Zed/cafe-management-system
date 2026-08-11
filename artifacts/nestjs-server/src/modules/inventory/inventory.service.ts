import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Supplier } from '../../entities/supplier.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { PurchaseOrder, POStatus } from '../../entities/purchase-order.entity';
import { StockAdjustment, AdjustmentType } from '../../entities/stock-adjustment.entity';
import { ItemRequest, ItemRequestStatus } from '../../entities/item-request.entity';
import { User } from '../../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private itemRepo: Repository<InventoryItem>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(StockAdjustment) private adjRepo: Repository<StockAdjustment>,
    @InjectRepository(ItemRequest) private reqRepo: Repository<ItemRequest>,
    private dataSource: DataSource,
    private notifications: NotificationsService,
  ) {}

  private assertBranch(entityBranchId: number | null | undefined, branchId?: number) {
    // Fail closed: a branch-scoped user may only touch records of their own branch (branchless records excluded)
    if (branchId && entityBranchId !== branchId) {
      throw new ForbiddenException('This record belongs to another branch');
    }
  }

  // Items
  findAllItems(restaurantId?: number, branchId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    if (branchId) where.branchId = branchId;
    return this.itemRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOneItem(id: number, branchId?: number) {
    const i = await this.itemRepo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Item not found');
    this.assertBranch(i.branchId, branchId);
    return i;
  }

  createItem(data: Partial<InventoryItem>, branchId?: number) {
    if (branchId) data.branchId = branchId;
    return this.itemRepo.save(this.itemRepo.create(data));
  }

  async updateItem(id: number, data: Partial<InventoryItem>, branchId?: number) {
    const i = await this.findOneItem(id, branchId);
    // Stock level is server-controlled: it only changes via PO receipt (stock in)
    // or item-request issuing (stock out), so movements always have an audit record.
    const { currentStock, ...rest } = data as any;
    Object.assign(i, rest);
    return this.itemRepo.save(i);
  }

  async removeItem(id: number, branchId?: number) {
    const i = await this.findOneItem(id, branchId);
    return this.itemRepo.remove(i);
  }

  getLowStockItems(restaurantId?: number, branchId?: number) {
    const qb = this.itemRepo.createQueryBuilder('item')
      .where('item.currentStock <= item.minStock');
    if (restaurantId) qb.andWhere('item.restaurantId = :rid', { rid: restaurantId });
    if (branchId) qb.andWhere('item.branchId = :bid', { bid: branchId });
    return qb.getMany();
  }

  // Suppliers (shared across branches within the restaurant)
  findAllSuppliers(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.supplierRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOneSupplier(id: number, restaurantId?: number) {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Supplier not found');
    if (restaurantId && (s as any).restaurantId && (s as any).restaurantId !== restaurantId) {
      throw new ForbiddenException('This supplier belongs to another restaurant');
    }
    return s;
  }

  createSupplier(data: Partial<Supplier>) { return this.supplierRepo.save(this.supplierRepo.create(data)); }

  async updateSupplier(id: number, data: Partial<Supplier>) {
    const s = await this.findOneSupplier(id);
    Object.assign(s, data);
    return this.supplierRepo.save(s);
  }

  // Purchase Orders
  findAllPOs(supplierId?: number, branchId?: number) {
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (branchId) where.branchId = branchId;
    return this.poRepo.find({ where, relations: ['supplier', 'items', 'items.inventoryItem', 'requestedBy', 'approvedBy'], order: { createdAt: 'DESC' } });
  }

  async findOnePO(id: number, branchId?: number) {
    const po = await this.poRepo.findOne({ where: { id }, relations: ['supplier', 'items', 'items.inventoryItem', 'requestedBy', 'approvedBy'] });
    if (!po) throw new NotFoundException('Purchase order not found');
    this.assertBranch(po.branchId, branchId);
    return po;
  }

  async createPO(data: any, user: User, branchId?: number) {
    await this.findOneSupplier(Number(data.supplierId), (user as any).restaurantId || undefined);

    const lines = (Array.isArray(data.items) ? data.items : [])
      .map((l: any) => ({
        inventoryItemId: Number(l.inventoryItemId),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice) || 0,
      }))
      .filter((l: any) => l.inventoryItemId && l.quantity > 0 && l.unitPrice >= 0);
    if (lines.length === 0) throw new BadRequestException('Purchase order needs at least one item with a positive quantity');

    const itemIds = lines.map((l: any) => l.inventoryItemId);
    const found = await this.itemRepo.find({ where: { id: In(itemIds) } });
    if (found.length !== new Set(itemIds).size) throw new BadRequestException('One or more inventory items do not exist');
    // All ordered items must belong to the requester's branch
    for (const item of found) this.assertBranch(item.branchId, branchId);

    // Total is always computed server-side from the accepted lines
    const totalAmount = lines.reduce((sum: number, l: any) => sum + l.quantity * l.unitPrice, 0);

    const po = this.poRepo.create({
      supplierId: Number(data.supplierId),
      notes: data.notes,
      expectedDelivery: data.expectedDelivery,
      status: POStatus.PENDING,
      requestedById: user.id,
      branchId: branchId || (user as any).branchId || undefined,
      totalAmount,
      items: lines,
    });
    const saved = await this.poRepo.save(po);
    await this.notifications.notify({
      roles: ['manager', 'owner'],
      message: `Purchase order #${saved.id} (ETB ${Number(saved.totalAmount).toLocaleString()}) awaits your approval`,
      branchId: saved.branchId,
    });
    return saved;
  }

  // Procurement flow: pending → approved (manager/owner) → paid (cashier) → received (storekeeper)
  private static readonly PO_TRANSITIONS: Record<string, string[]> = {
    [POStatus.DRAFT]: [POStatus.PENDING],
    [POStatus.PENDING]: [POStatus.APPROVED, POStatus.REJECTED],
    [POStatus.APPROVED]: [POStatus.PAID, POStatus.RECEIVED], // cashier payment optional — storekeeper may stock in directly once approved
    [POStatus.PAID]: [POStatus.RECEIVED],
    [POStatus.ORDERED]: [POStatus.RECEIVED], // legacy rows
    [POStatus.RECEIVED]: [],
    [POStatus.REJECTED]: [],
  };

  /** Per-line approval: manager/owner approve selected items or all at once; PO becomes approved when every line is approved */
  async approvePOItems(id: number, body: { itemIds?: number[]; all?: boolean }, user: User, branchId?: number) {
    const po = await this.findOnePO(id, branchId);
    if (![POStatus.PENDING, POStatus.DRAFT].includes(po.status)) {
      throw new BadRequestException(`Purchase order is already '${po.status}'`);
    }
    const targetIds = body.all
      ? po.items.filter(i => !i.approved).map(i => i.id)
      : (body.itemIds || []).filter(iid => po.items.some(i => i.id === iid && !i.approved));
    if (!targetIds.length) throw new BadRequestException('No pending items selected for approval');

    await this.dataSource.transaction(async (em) => {
      // Lock the PO row so concurrent approvals/rejections serialize, then re-check status
      const locked = await em.getRepository(PurchaseOrder).findOne({ where: { id: po.id }, lock: { mode: 'pessimistic_write' } });
      if (!locked || ![POStatus.PENDING, POStatus.DRAFT].includes(locked.status)) {
        throw new BadRequestException(`Purchase order is already '${locked?.status || 'gone'}'`);
      }
      await em.createQueryBuilder()
        .update(PurchaseOrderItem)
        .set({ approved: true, approvedById: user.id })
        .where('id IN (:...ids) AND "purchaseOrderId" = :poId AND approved = false', { ids: targetIds, poId: po.id })
        .execute();
      const remaining = await em.count(PurchaseOrderItem, { where: { purchaseOrderId: po.id, approved: false } });
      if (remaining === 0) {
        await em.createQueryBuilder()
          .update(PurchaseOrder)
          .set({ status: POStatus.APPROVED, approvedById: user.id })
          .where('id = :id AND status IN (:...from)', { id: po.id, from: [POStatus.PENDING, POStatus.DRAFT] })
          .execute();
      }
    });

    const updated = await this.findOnePO(id, branchId);
    const approvedNames = updated.items.filter(i => targetIds.includes(i.id)).map(i => i.inventoryItem?.name).filter(Boolean).join(', ');
    const who = user.name || user.role;
    if (updated.status === POStatus.APPROVED) {
      await this.notifications.notify({ roles: ['manager', 'owner', 'storekeeper'], userId: updated.requestedById || undefined, message: `Purchase order #${updated.id} fully approved by ${who} (ETB ${Number(updated.totalAmount).toLocaleString()}) — stock in when goods arrive`, branchId: updated.branchId });
    } else {
      await this.notifications.notify({ roles: ['manager', 'owner'], message: `${who} approved ${approvedNames} on purchase order #${updated.id} — some items still awaiting approval`, branchId: updated.branchId });
    }
    return updated;
  }

  async updatePOStatus(id: number, status: string, user: User, branchId?: number) {
    const po = await this.findOnePO(id, branchId);
    const allowed = InventoryService.PO_TRANSITIONS[po.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot change purchase order from '${po.status}' to '${status}'`);
    }
    if ((status === POStatus.APPROVED || status === POStatus.REJECTED) && !['admin', 'owner', 'manager'].includes(user.role as any)) {
      throw new ForbiddenException('Only managers and above can approve or reject purchase orders');
    }
    if (status === POStatus.PAID && !['admin', 'owner', 'cashier'].includes(user.role as any)) {
      throw new ForbiddenException('Only the cashier can confirm payment of a purchase order');
    }
    if (status === POStatus.RECEIVED && !['admin', 'owner', 'manager', 'storekeeper'].includes(user.role as any)) {
      throw new ForbiddenException('Only the store keeper, manager or owner can receive goods into stock');
    }

    if (status === POStatus.RECEIVED) {
      // Goods receipt: conditional status flip guards against concurrent double-receipt,
      // then increment stock and record movements in the same transaction.
      const saved = await this.dataSource.transaction(async (em) => {
        const res = await em.createQueryBuilder()
          .update(PurchaseOrder)
          .set({ status: POStatus.RECEIVED })
          .where('id = :id AND status IN (:...from)', { id: po.id, from: [POStatus.APPROVED, POStatus.PAID, POStatus.ORDERED] })
          .execute();
        if (!res.affected) throw new BadRequestException('Purchase order was already received');
        for (const item of po.items) {
          await em.increment(InventoryItem, { id: item.inventoryItemId }, 'currentStock', Number(item.quantity));
          await em.save(em.create(StockAdjustment, {
            inventoryItemId: item.inventoryItemId,
            type: AdjustmentType.ADDITION,
            quantity: Number(item.quantity),
            reason: `PO #${po.id} received (stock in)`,
            createdById: user.id,
            branchId: po.branchId || undefined,
          }));
        }
        po.status = POStatus.RECEIVED;
        return po;
      });
      await this.notifications.notify({ roles: ['manager', 'owner'], message: `Purchase order #${po.id} received — stock updated by ${user.name || 'store keeper'}`, branchId: po.branchId });
      return saved;
    }

    let saved: PurchaseOrder = po;
    if (status === POStatus.APPROVED || status === POStatus.REJECTED) {
      // Guarded transition: approve-all is an atomic shortcut that also approves every line,
      // so a PO can never be 'approved' while lines remain unapproved.
      await this.dataSource.transaction(async (em) => {
        const flip = await em.createQueryBuilder()
          .update(PurchaseOrder)
          .set({ status: status as POStatus, approvedById: user.id })
          .where('id = :id AND status IN (:...from)', { id: po.id, from: [POStatus.PENDING, POStatus.DRAFT] })
          .execute();
        if (!flip.affected) throw new BadRequestException('Purchase order was already approved or rejected');
        if (status === POStatus.APPROVED) {
          await em.createQueryBuilder()
            .update(PurchaseOrderItem)
            .set({ approved: true, approvedById: user.id })
            .where('"purchaseOrderId" = :poId AND approved = false', { poId: po.id })
            .execute();
        }
      });
      po.status = status as POStatus;
      po.approvedById = user.id;
    } else {
      po.status = status as POStatus;
      if (status === POStatus.PAID) po.paidById = user.id;
      saved = await this.poRepo.save(po);
    }

    if (status === POStatus.APPROVED) {
      await this.notifications.notify({ roles: ['manager', 'owner', 'storekeeper'], userId: po.requestedById || undefined, message: `Purchase order #${po.id} approved by ${user.name || user.role} (ETB ${Number(po.totalAmount).toLocaleString()}) — stock in when goods arrive`, branchId: po.branchId });
    } else if (status === POStatus.REJECTED) {
      await this.notifications.notify({ userId: po.requestedById || undefined, message: `Purchase order #${po.id} was rejected`, branchId: po.branchId });
    } else if (status === POStatus.PAID) {
      await this.notifications.notify({ roles: ['storekeeper'], message: `Purchase order #${po.id} paid — fill the stock in when goods arrive`, branchId: po.branchId });
    }
    return saved;
  }

  // Stock Adjustments
  async createAdjustment(data: { inventoryItemId: number; type: AdjustmentType; quantity: number; reason?: string; branchId?: number }, user: User, branchId?: number) {
    const item = await this.findOneItem(data.inventoryItemId, branchId);
    const qty = Math.abs(Number(data.quantity));
    if (!(qty > 0)) throw new BadRequestException('Quantity must be greater than zero');
    const isAddition = data.type === AdjustmentType.ADDITION;

    return this.dataSource.transaction(async (em) => {
      if (isAddition) {
        await em.increment(InventoryItem, { id: item.id }, 'currentStock', qty);
      } else {
        const dec = await em.createQueryBuilder()
          .update(InventoryItem)
          .set({ currentStock: () => `"currentStock" - ${qty}` })
          .where('id = :id AND "currentStock" >= :qty', { id: item.id, qty })
          .execute();
        if (!dec.affected) throw new BadRequestException(`Not enough stock: only ${Number(item.currentStock)} ${item.unit} available`);
      }
      return em.save(em.create(StockAdjustment, {
        inventoryItemId: item.id,
        type: data.type,
        quantity: qty,
        reason: data.reason,
        createdById: user.id, // always the authenticated user — never caller-supplied
        branchId: branchId || item.branchId || undefined,
      }));
    });
  }

  findAllAdjustments(inventoryItemId?: number, branchId?: number, type?: string, from?: string, to?: string) {
    const qb = this.adjRepo.createQueryBuilder('adj')
      .leftJoinAndSelect('adj.inventoryItem', 'item')
      .leftJoinAndSelect('adj.createdBy', 'createdBy')
      .orderBy('adj.createdAt', 'DESC');
    if (inventoryItemId) qb.andWhere('adj.inventoryItemId = :inventoryItemId', { inventoryItemId });
    if (branchId) qb.andWhere('adj.branchId = :branchId', { branchId });
    if (type !== undefined && type !== '') {
      if (!Object.values(AdjustmentType).includes(type as AdjustmentType)) {
        throw new BadRequestException(`Invalid movement type '${type}'`);
      }
      qb.andWhere('adj.type = :type', { type });
    }
    const parseDate = (v: string, label: string) => {
      const d = new Date(v);
      if (isNaN(d.getTime())) throw new BadRequestException(`Invalid ${label} date`);
      return d;
    };
    const fromDate = from ? parseDate(from, 'from') : undefined;
    const toDate = to ? parseDate(to, 'to') : undefined;
    if (fromDate && toDate && fromDate > toDate) throw new BadRequestException('From date must not be after the to date');
    if (fromDate) qb.andWhere('adj.createdAt >= :from', { from: fromDate });
    if (toDate) {
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1); // inclusive end date
      qb.andWhere('adj.createdAt < :to', { to: end });
    }
    return qb.getMany();
  }

  // ── Item Requests ─────────────────────────────────────────────────────────
  // Flow: any staff requests → manager/owner approve → storekeeper issues (stock out) → requester confirms receipt

  private static readonly REQUEST_TRANSITIONS: Record<string, string[]> = {
    [ItemRequestStatus.PENDING]: [ItemRequestStatus.APPROVED, ItemRequestStatus.REJECTED],
    [ItemRequestStatus.APPROVED]: [ItemRequestStatus.ISSUED],
    [ItemRequestStatus.ISSUED]: [ItemRequestStatus.RECEIVED],
    [ItemRequestStatus.REJECTED]: [],
    [ItemRequestStatus.RECEIVED]: [],
  };

  findAllRequests(user: User, branchId?: number) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    // Regular staff only see their own requests; managers/storekeepers see all in their branch
    if (!['admin', 'owner', 'manager', 'storekeeper'].includes(user.role as any)) {
      where.requestedById = user.id;
    }
    return this.reqRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async createRequest(data: { inventoryItemId: number; quantity: number; notes?: string; requesterName?: string; reason?: string }, user: User, branchId?: number) {
    const qty = Number(data.quantity);
    if (!(qty > 0)) throw new BadRequestException('Quantity must be greater than zero');
    const item = await this.findOneItem(Number(data.inventoryItemId), branchId);
    const req = this.reqRepo.create({
      inventoryItemId: item.id,
      quantity: qty,
      notes: data.notes,
      requesterName: data.requesterName?.trim() || user.name || undefined,
      reason: data.reason?.trim() || undefined,
      unitCost: Number(item.unitCost) || 0,
      requestedById: user.id,
      branchId: branchId || (user as any).branchId || item.branchId || undefined,
      status: ItemRequestStatus.PENDING,
    });
    const saved = await this.reqRepo.save(req);
    await this.notifications.notify({
      roles: ['manager', 'owner'],
      message: `${user.name || 'Staff'} requested ${qty} ${item.unit} of ${item.name} — awaiting approval`,
      branchId: saved.branchId,
    });
    return saved;
  }

  async updateRequestStatus(id: number, status: string, user: User, branchId?: number, adjustQuantity?: number) {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Item request not found');
    this.assertBranch(req.branchId, branchId);

    const allowed = InventoryService.REQUEST_TRANSITIONS[req.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot change request from '${req.status}' to '${status}'`);
    }
    if ((status === ItemRequestStatus.APPROVED || status === ItemRequestStatus.REJECTED) && !['admin', 'owner', 'manager'].includes(user.role as any)) {
      throw new ForbiddenException('Only managers and above can approve or reject item requests');
    }
    if (status === ItemRequestStatus.ISSUED && !['admin', 'owner', 'storekeeper'].includes(user.role as any)) {
      throw new ForbiddenException('Only the store keeper can issue the stock out');
    }
    if (status === ItemRequestStatus.RECEIVED && req.requestedById !== user.id && !['admin', 'owner'].includes(user.role as any)) {
      throw new ForbiddenException('Only the requester can confirm the items were received');
    }

    const item = req.inventoryItem || (await this.findOneItem(req.inventoryItemId));

    if (status === ItemRequestStatus.ISSUED) {
      // Stock out: conditional updates guard against concurrent double-issue and negative stock
      await this.dataSource.transaction(async (em) => {
        const flip = await em.createQueryBuilder()
          .update(ItemRequest)
          .set({ status: ItemRequestStatus.ISSUED, issuedById: user.id })
          .where('id = :id AND status = :from', { id: req.id, from: ItemRequestStatus.APPROVED })
          .execute();
        if (!flip.affected) throw new BadRequestException('Request was already issued');
        const dec = await em.createQueryBuilder()
          .update(InventoryItem)
          .set({ currentStock: () => `"currentStock" - ${Number(req.quantity)}` })
          .where('id = :id AND "currentStock" >= :qty', { id: req.inventoryItemId, qty: Number(req.quantity) })
          .execute();
        if (!dec.affected) {
          throw new BadRequestException(`Not enough stock: only ${Number(item.currentStock)} ${item.unit} of ${item.name} available`);
        }
        await em.save(em.create(StockAdjustment, {
          inventoryItemId: req.inventoryItemId,
          type: AdjustmentType.DEDUCTION,
          quantity: Number(req.quantity),
          reason: `Item request #${req.id} issued to ${req.requestedBy?.name || 'staff'} (stock out)`,
          createdById: user.id,
          branchId: req.branchId || undefined,
        }));
      });
      await this.notifications.notify({ userId: req.requestedById, message: `Your request for ${Number(req.quantity)} ${item.unit} of ${item.name} was issued — please confirm receipt`, branchId: req.branchId });
      return this.reqRepo.findOne({ where: { id } });
    }

    if (status === ItemRequestStatus.APPROVED || status === ItemRequestStatus.REJECTED) {
      // Conditional update guards against two managers acting on the same request concurrently
      const set: any = { status: status as ItemRequestStatus, approvedById: user.id };
      if (status === ItemRequestStatus.APPROVED && adjustQuantity !== undefined && adjustQuantity !== null) {
        const q = Number(adjustQuantity);
        if (!(q > 0)) throw new BadRequestException('Adjusted quantity must be greater than zero');
        set.quantity = q;
        req.quantity = q; // for the notification message below
      }
      const flip = await this.reqRepo.createQueryBuilder()
        .update(ItemRequest)
        .set(set)
        .where('id = :id AND status = :from', { id: req.id, from: ItemRequestStatus.PENDING })
        .execute();
      if (!flip.affected) throw new BadRequestException('Request was already approved or rejected by another manager');
      req.status = status as ItemRequestStatus;
      req.approvedById = user.id;
    } else {
      req.status = status as ItemRequestStatus;
      await this.reqRepo.save(req);
    }
    const saved = req;

    if (status === ItemRequestStatus.APPROVED) {
      await this.notifications.notify({ roles: ['storekeeper'], userId: req.requestedById, message: `Item request #${req.id} (${Number(req.quantity)} ${item.unit} of ${item.name}) approved — storekeeper to issue stock out`, branchId: req.branchId });
    } else if (status === ItemRequestStatus.REJECTED) {
      await this.notifications.notify({ roles: ['storekeeper'], userId: req.requestedById, message: `Item request #${req.id} (${item.name}) was rejected by ${user.name || 'manager'}`, branchId: req.branchId });
    } else if (status === ItemRequestStatus.RECEIVED) {
      await this.notifications.notify({ roles: ['storekeeper', 'manager'], message: `Item request #${req.id} (${item.name}) confirmed received by ${user.name || 'requester'}`, branchId: req.branchId });
    }
    return saved;
  }
}
