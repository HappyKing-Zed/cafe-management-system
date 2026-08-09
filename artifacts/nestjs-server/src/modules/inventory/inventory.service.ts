import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Supplier } from '../../entities/supplier.entity';
import { PurchaseOrder, POStatus } from '../../entities/purchase-order.entity';
import { StockAdjustment, AdjustmentType } from '../../entities/stock-adjustment.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private itemRepo: Repository<InventoryItem>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(StockAdjustment) private adjRepo: Repository<StockAdjustment>,
    private dataSource: DataSource,
  ) {}

  // Items
  findAllItems(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.itemRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOneItem(id: number) {
    const i = await this.itemRepo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Item not found');
    return i;
  }

  createItem(data: Partial<InventoryItem>) { return this.itemRepo.save(this.itemRepo.create(data)); }

  async updateItem(id: number, data: Partial<InventoryItem>) {
    const i = await this.findOneItem(id);
    Object.assign(i, data);
    return this.itemRepo.save(i);
  }

  async removeItem(id: number) {
    const i = await this.findOneItem(id);
    return this.itemRepo.remove(i);
  }

  getLowStockItems(restaurantId?: number) {
    return this.itemRepo.createQueryBuilder('item')
      .where('item.currentStock <= item.minStock')
      .andWhere(restaurantId ? 'item.restaurantId = :rid' : '1=1', { rid: restaurantId })
      .getMany();
  }

  // Suppliers
  findAllSuppliers(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.supplierRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOneSupplier(id: number) {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  createSupplier(data: Partial<Supplier>) { return this.supplierRepo.save(this.supplierRepo.create(data)); }

  async updateSupplier(id: number, data: Partial<Supplier>) {
    const s = await this.findOneSupplier(id);
    Object.assign(s, data);
    return this.supplierRepo.save(s);
  }

  // Purchase Orders
  findAllPOs(supplierId?: number) {
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    return this.poRepo.find({ where, relations: ['supplier', 'items', 'items.inventoryItem', 'requestedBy', 'approvedBy'], order: { createdAt: 'DESC' } });
  }

  async findOnePO(id: number) {
    const po = await this.poRepo.findOne({ where: { id }, relations: ['supplier', 'items', 'items.inventoryItem', 'requestedBy'] });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async createPO(data: any, user: User) {
    await this.findOneSupplier(Number(data.supplierId));

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

    // Total is always computed server-side from the accepted lines
    const totalAmount = lines.reduce((sum: number, l: any) => sum + l.quantity * l.unitPrice, 0);

    const po = this.poRepo.create({
      supplierId: Number(data.supplierId),
      notes: data.notes,
      expectedDelivery: data.expectedDelivery,
      status: POStatus.PENDING,
      requestedById: user.id,
      totalAmount,
      items: lines,
    });
    return this.poRepo.save(po);
  }

  private static readonly PO_TRANSITIONS: Record<string, string[]> = {
    [POStatus.DRAFT]: [POStatus.PENDING],
    [POStatus.PENDING]: [POStatus.APPROVED, POStatus.REJECTED],
    [POStatus.APPROVED]: [POStatus.ORDERED, POStatus.RECEIVED],
    [POStatus.ORDERED]: [POStatus.RECEIVED],
    [POStatus.RECEIVED]: [],
    [POStatus.REJECTED]: [],
  };

  async updatePOStatus(id: number, status: string, user: User) {
    const po = await this.findOnePO(id);
    const allowed = InventoryService.PO_TRANSITIONS[po.status] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Cannot change purchase order from '${po.status}' to '${status}'`);
    }
    if ((status === POStatus.APPROVED || status === POStatus.REJECTED) && !['admin', 'owner', 'manager'].includes(user.role as any)) {
      throw new ForbiddenException('Only managers and above can approve or reject purchase orders');
    }

    if (status === POStatus.RECEIVED) {
      // Goods receipt: increment stock and persist status atomically (transition guard prevents double receipt)
      return this.dataSource.transaction(async (em) => {
        for (const item of po.items) {
          await em.increment(InventoryItem, { id: item.inventoryItemId }, 'currentStock', Number(item.quantity));
        }
        po.status = POStatus.RECEIVED;
        return em.save(po);
      });
    }

    po.status = status as POStatus;
    if (status === POStatus.APPROVED || status === POStatus.REJECTED) po.approvedById = user.id;
    return this.poRepo.save(po);
  }

  // Stock Adjustments
  async createAdjustment(data: { inventoryItemId: number; type: AdjustmentType; quantity: number; reason?: string; createdById?: number }) {
    const item = await this.findOneItem(data.inventoryItemId);
    const adj = this.adjRepo.create(data);
    await this.adjRepo.save(adj);

    const delta = data.type === AdjustmentType.ADDITION ? data.quantity : -Math.abs(data.quantity);
    await this.itemRepo.increment({ id: data.inventoryItemId }, 'currentStock', delta);

    return adj;
  }

  findAllAdjustments(inventoryItemId?: number) {
    const where: any = {};
    if (inventoryItemId) where.inventoryItemId = inventoryItemId;
    return this.adjRepo.find({ where, relations: ['inventoryItem', 'createdBy'], order: { createdAt: 'DESC' } });
  }
}
