import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { RestaurantTable } from '../../entities/table.entity';
import { User } from '../../entities/user.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { TableStatus } from '../../common/enums/table-status.enum';
import { OrderItemStatus } from '../../common/enums/order-item-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  constructor(
    private notifications: NotificationsService,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(MenuItem) private menuRepo: Repository<MenuItem>,
    @InjectRepository(RestaurantTable) private tableRepo: Repository<RestaurantTable>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async findAll(status?: OrderStatus, tableId?: number, waiterId?: number, branchId?: number, user?: { role: string }) {
    if (user?.role === 'cashier') status = OrderStatus.SERVED;
    const where: any = {};
    if (status) where.status = status;
    if (tableId) where.tableId = tableId;
    if (waiterId) where.waiterId = waiterId;
    if (branchId) where.branchId = branchId;
    const orders = await this.orderRepo.find({
      where,
      relations: ['table', 'waiter', 'chef', 'items', 'items.menuItem', 'payments'],
      order: { createdAt: 'DESC' },
    });
    if (user?.role === 'cashier') {
      return orders.filter((order) => order.items.every((item) => !item.status || item.status === OrderItemStatus.SERVED));
    }
    return orders;
  }

  async findOne(id: number) {
    const o = await this.orderRepo.findOne({
      where: { id },
      relations: ['table', 'waiter', 'chef', 'items', 'items.menuItem', 'payments'],
    });
    if (!o) throw new NotFoundException('Order not found');
    // Production-safe compatibility for pre-lifecycle rows. The nullable
    // schema addition does not rewrite historical items to "pending".
    for (const item of o.items || []) {
      if (!item.status) item.status = this.legacyItemStatus(o.status);
    }
    return o;
  }

  private legacyItemStatus(status: OrderStatus): OrderItemStatus {
    switch (status) {
      case OrderStatus.CONFIRMED: return OrderItemStatus.CONFIRMED;
      case OrderStatus.PREPARING: return OrderItemStatus.PREPARING;
      case OrderStatus.READY: return OrderItemStatus.READY;
      case OrderStatus.SERVED:
      case OrderStatus.PAID: return OrderItemStatus.SERVED;
      default: return OrderItemStatus.PENDING;
    }
  }

  /** Waiters may only access their own orders; branch staff only their branch's orders. */
  private assertCanAccess(order: Order, user?: { id: number; role: string; branchId?: number }) {
    if (user?.role === 'waiter' && order.waiterId !== user.id) {
      throw new ForbiddenException('You can only access your own orders');
    }
    if (user && !['admin', 'owner'].includes(user.role) && user.branchId && order.branchId && order.branchId !== user.branchId) {
      throw new ForbiddenException('This order belongs to another branch');
    }
  }

  async findOneAuthorized(id: number, user?: { id: number; role: string }) {
    const order = await this.findOne(id);
    this.assertCanAccess(order, user);
    if (user?.role === 'cashier' && order.status !== OrderStatus.SERVED) {
      throw new ForbiddenException('Cashiers can only access served orders awaiting payment');
    }
    if (user?.role === 'cashier' && order.items.some((item) => item.status !== OrderItemStatus.SERVED)) {
      throw new ForbiddenException('Cashiers can only access fully served orders');
    }
    return order;
  }

  async create(data: { tableId?: number; waiterId?: number; notes?: string; customerName?: string; customerPhone?: string; guestCount?: number; serviceChargePct?: number; items?: Array<{ menuItemId: number; quantity: number; notes?: string }> }, creator?: { id: number; role: string; branchId?: number }) {
    if (creator?.role === 'cashier') {
      throw new ForbiddenException('Cashiers cannot create orders');
    }
    const customerPhone = data.customerPhone?.trim();
    if (!data.tableId && !customerPhone) {
      throw new BadRequestException('A client phone number is required for takeaway orders');
    }
    if (data.waiterId) {
      const waiter = await this.userRepo.findOne({ where: { id: data.waiterId } });
      if (!waiter || waiter.role !== ('waiter' as any) || !waiter.isActive) {
        throw new BadRequestException('waiterId must reference an active waiter');
      }
    }
    // Tag the order with its branch: from the table if set, otherwise from the creator
    let branchId: number | undefined = creator?.branchId || undefined;
    if (data.tableId) {
      const table = await this.tableRepo.findOne({ where: { id: data.tableId } });
      if (table?.branchId) branchId = table.branchId;
    }

    const order = this.orderRepo.create({
      tableId: data.tableId,
      waiterId: data.waiterId,
      branchId,
      notes: data.notes,
      customerName: data.customerName,
      customerPhone,
      guestCount: data.guestCount || 1,
      serviceChargePct: Math.min(100, Math.max(0, Number(data.serviceChargePct) || 0)),
      status: OrderStatus.PENDING,
    });

    if (data.items && data.items.length > 0) {
      let total = 0;
      const orderItems: OrderItem[] = [];
      for (const item of data.items) {
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
          throw new BadRequestException('Item quantity must be a positive integer');
        }
        const menuItem = await this.menuRepo.findOne({ where: { id: item.menuItemId } });
        if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
        const oi = this.itemRepo.create({
          menuItemId: item.menuItemId,
          quantity: Number(item.quantity),
          unitPrice: menuItem.price,
          notes: item.notes,
          status: OrderItemStatus.PENDING,
        });
        orderItems.push(oi);
        total += Number(menuItem.price) * item.quantity;
      }
      order.items = orderItems;
      order.totalAmount = Math.round(total * (1 + Number(order.serviceChargePct || 0) / 100) * 100) / 100;
    }

    // Saving and occupying the table are one unit. orderNumber is generated by
    // PostgreSQL's sequence, which is concurrency-safe across all instances.
    const saved = await this.dataSource.transaction(async (manager) => {
      const persisted = await manager.getRepository(Order).save(order);
      if (data.tableId) {
        await manager.getRepository(RestaurantTable).update(data.tableId, { status: TableStatus.OCCUPIED });
      }
      return persisted;
    });

    const full = await this.findOne(saved.id);
    await this.notifications.orderEvent(full, 'created');
    return full;
  }

  async addItems(orderId: number, items: Array<{ menuItemId: number; quantity: number; notes?: string }>, user?: { id: number; role: string }) {
    if (user && !['waiter', 'admin', 'owner'].includes(user.role)) {
      throw new ForbiddenException('Your role cannot add order items');
    }
    await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :orderId', { orderId })
        .getOne();
      if (!order) throw new NotFoundException('Order not found');
      // PostgreSQL cannot FOR UPDATE the nullable side of an outer join.
      // Lock the parent first, then read its items in the same transaction.
      order.items = await manager.getRepository(OrderItem).find({ where: { orderId } });
      this.assertCanAccess(order, user);
      if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot modify a paid or cancelled order');
      }
      for (const item of items) {
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
          throw new BadRequestException('Item quantity must be a positive integer');
        }
        const menuItem = await manager.getRepository(MenuItem).findOne({ where: { id: item.menuItemId } });
        if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
        await manager.getRepository(OrderItem).save(manager.getRepository(OrderItem).create({
          orderId, menuItemId: item.menuItemId, quantity: Number(item.quantity),
          unitPrice: menuItem.price, notes: item.notes, status: OrderItemStatus.PENDING,
        }));
      }
      const allItems = await manager.getRepository(OrderItem).find({ where: { orderId } });
      const subtotal = allItems.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
      const total = Math.round(subtotal * (1 + Number(order.serviceChargePct || 0) / 100) * 100) / 100;
      await manager.getRepository(Order).update(orderId, { totalAmount: total });
    });
    return this.findOne(orderId);
  }

  async removeItems(orderId: number, orderItemIds: number[], user?: { id: number; role: string }) {
    if (user && !['waiter', 'admin', 'owner'].includes(user.role)) {
      throw new ForbiddenException('Your role cannot remove order items');
    }
    const order = await this.findOne(orderId);
    this.assertCanAccess(order, user);
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a paid or cancelled order');
    }
    const toRemove = order.items.filter(i => orderItemIds.includes(i.id));
    if (toRemove.length === 0) throw new BadRequestException('No matching items on this order');
    if (user?.role === 'waiter' && toRemove.some((item) => item.status !== OrderItemStatus.PENDING)) {
      throw new ForbiddenException('Only pending items can be removed');
    }

    if (toRemove.length >= order.items.length) {
      // Removing everything cancels the order
      return this.updateStatus(orderId, OrderStatus.CANCELLED, user);
    }
    await this.itemRepo.remove(toRemove);
    const updated = await this.findOne(orderId);
    const subtotal = updated.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    const total = Math.round(subtotal * (1 + Number(updated.serviceChargePct || 0) / 100) * 100) / 100;
    await this.orderRepo.update(orderId, { totalAmount: total });
    return this.findOne(orderId);
  }

  // Explicit allowlist: an absent role must never mean unrestricted access.
  private static readonly ROLE_STATUS: Record<string, OrderStatus[]> = {
    waiter: [OrderStatus.SERVED, OrderStatus.CANCELLED],
    coordinator: [OrderStatus.CONFIRMED],
    chef: [OrderStatus.PREPARING, OrderStatus.READY],
    cashier: [OrderStatus.PAID],
    manager: [],
    storekeeper: [],
    admin: Object.values(OrderStatus),
    owner: Object.values(OrderStatus),
  };

  // Valid lifecycle transitions (applies to everyone, kitchen included)
  static readonly TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.SERVED],
    [OrderStatus.SERVED]: [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [],
    [OrderStatus.CANCELLED]: [],
  };

  async updateStatus(id: number, status: OrderStatus, user?: { id: number; role: string }, chefId?: number) {
    if (status === OrderStatus.CANCELLED && user?.role !== 'waiter') {
      throw new ForbiddenException('Only the owning waiter can cancel an order');
    }
    if (user) {
      const existing = await this.findOne(id);
      this.assertCanAccess(existing, user);
      const allowed = OrdersService.ROLE_STATUS[user.role] || [];
      if (!allowed.includes(status)) {
        throw new ForbiddenException(`Your role cannot set an order to "${status}"`);
      }
      // Only the cashier (or admin/owner) may confirm payment
      if (status === OrderStatus.PAID && !['cashier', 'admin', 'owner'].includes(user.role)) {
        throw new ForbiddenException('Only the cashier can confirm payment');
      }
      if (
        status === OrderStatus.CANCELLED &&
        user.role === 'waiter' &&
        (existing.status !== OrderStatus.PENDING ||
          existing.items.some((item) => item.status !== OrderItemStatus.PENDING))
      ) {
        throw new ForbiddenException('An order can only be cancelled before any coordinator confirmation');
      }
    }
    const before = await this.findOne(id);
    if (before.status !== status && !OrdersService.TRANSITIONS[before.status]?.includes(status)) {
      throw new BadRequestException(`Cannot move an order from "${before.status}" to "${status}"`);
    }
    if (status === OrderStatus.PAID && before.items.some((item) => item.status !== OrderItemStatus.SERVED)) {
      throw new BadRequestException('Only fully served orders can be paid');
    }
    if (status === OrderStatus.SERVED) {
      const unfinished = before.items.filter((item) => item.status !== OrderItemStatus.SERVED);
      if (unfinished.some((item) => item.status !== OrderItemStatus.READY)) {
        throw new BadRequestException('All outstanding items must be ready before the order can be served');
      }
      if (unfinished.length) await this.itemRepo.update(unfinished.map((item) => item.id), { status: OrderItemStatus.SERVED });
    } else if (status === OrderStatus.CONFIRMED) {
      const pending = before.items.filter((item) => item.status === OrderItemStatus.PENDING);
      if (pending.length) await this.itemRepo.update(pending.map((item) => item.id), { status: OrderItemStatus.CONFIRMED });
    } else if (status === OrderStatus.PREPARING) {
      const accepted = before.items.filter((item) => item.status === OrderItemStatus.ACCEPTED);
      if (!accepted.length) throw new BadRequestException('Items must be accepted before preparation');
      await this.itemRepo.update(accepted.map((item) => item.id), { status: OrderItemStatus.PREPARING });
    } else if (status === OrderStatus.READY) {
      const preparing = before.items.filter((item) => item.status === OrderItemStatus.PREPARING);
      if (!preparing.length) throw new BadRequestException('Items must be preparing before they can be ready');
      await this.itemRepo.update(preparing.map((item) => item.id), { status: OrderItemStatus.READY });
    }
    await this.orderRepo.update(id, { status, ...(chefId ? { chefId } : {}) });
    const order = await this.findOne(id);
    if (before.status !== status) await this.notifications.orderEvent(order, status);

    // Free table when order is paid/cancelled
    if ((status === OrderStatus.PAID || status === OrderStatus.CANCELLED) && order.tableId) {
      await this.tableRepo.update(order.tableId, { status: TableStatus.CLEANING });
    }
    return order;
  }

  static readonly ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
    [OrderItemStatus.PENDING]: [OrderItemStatus.CONFIRMED],
    [OrderItemStatus.CONFIRMED]: [OrderItemStatus.ACCEPTED],
    [OrderItemStatus.ACCEPTED]: [OrderItemStatus.PREPARING],
    [OrderItemStatus.PREPARING]: [OrderItemStatus.READY],
    [OrderItemStatus.READY]: [OrderItemStatus.SERVED],
    [OrderItemStatus.SERVED]: [],
  };

  async updateItemStatus(
    orderId: number,
    itemId: number,
    status: OrderItemStatus,
    user?: { id: number; role: string },
  ) {
    const order = await this.findOne(orderId);
    this.assertCanAccess(order, user);
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot update items on a paid or cancelled order');
    }
    const item = order.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundException('Order item not found');

    const permittedRoles: Record<OrderItemStatus, string[]> = {
      [OrderItemStatus.PENDING]: [],
      [OrderItemStatus.CONFIRMED]: ['coordinator', 'admin', 'owner'],
      [OrderItemStatus.ACCEPTED]: ['chef', 'admin', 'owner'],
      [OrderItemStatus.PREPARING]: ['chef', 'admin', 'owner'],
      [OrderItemStatus.READY]: ['chef', 'admin', 'owner'],
      [OrderItemStatus.SERVED]: ['waiter', 'admin', 'owner'],
    };
    if (!user || !permittedRoles[status]?.includes(user.role)) {
      throw new ForbiddenException(`Your role cannot set an item to "${status}"`);
    }
    if (item.status !== status && !OrdersService.ITEM_TRANSITIONS[item.status]?.includes(status)) {
      throw new BadRequestException(`Cannot move an item from "${item.status}" to "${status}"`);
    }
    if (item.status !== status) await this.itemRepo.update(item.id, { status });

    const updated = await this.findOne(orderId);
    const statuses = updated.items.map((candidate) => candidate.status);
    let aggregate = updated.status;
    if (statuses.every((value) => value === OrderItemStatus.SERVED)) aggregate = OrderStatus.SERVED;
    else if (statuses.every((value) => [OrderItemStatus.READY, OrderItemStatus.SERVED].includes(value))) aggregate = OrderStatus.READY;
    else if (statuses.some((value) => value === OrderItemStatus.PREPARING)) aggregate = OrderStatus.PREPARING;
    else if (statuses.every((value) => value !== OrderItemStatus.PENDING)) aggregate = OrderStatus.CONFIRMED;

    // Never move a previously-served order backwards when a waiter adds items.
    if (updated.status !== OrderStatus.SERVED && aggregate !== updated.status) {
      await this.orderRepo.update(orderId, { status: aggregate });
      const full = await this.findOne(orderId);
      await this.notifications.orderEvent(full, aggregate);
      return full;
    }
    return updated;
  }

  async getAlerts(branchId?: number) {
    const scope = branchId ? { branchId } : {};
    const active = await this.orderRepo.find({
      where: [
        { status: OrderStatus.PENDING, ...scope },
        { status: OrderStatus.CONFIRMED, ...scope },
        { status: OrderStatus.PREPARING, ...scope },
        { status: OrderStatus.READY, ...scope },
      ],
      relations: ['table', 'waiter'],
      order: { createdAt: 'ASC' },
    });

    const now = Date.now();
    const alerts: any[] = [];
    for (const o of active) {
      const refTime = new Date(o.updatedAt || o.createdAt).getTime();
      const minutes = Math.floor((now - refTime) / 60000);
      const tableLabel = o.table?.number ? `Table ${o.table.number}` : (o.customerName || 'Walk-in');
      const waiterName = o.waiter?.name;

      if (o.status === OrderStatus.PENDING && minutes >= 5) {
        alerts.push({ orderId: o.id, side: 'kitchen', severity: minutes >= 15 ? 'critical' : 'warning', status: o.status, minutes, message: `Order #${o.orderNumber || o.id} (${tableLabel}) waiting for kitchen confirmation for ${minutes} min` });
      } else if ((o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.PREPARING) && minutes >= 20) {
        alerts.push({ orderId: o.id, side: 'kitchen', severity: minutes >= 35 ? 'critical' : 'warning', status: o.status, minutes, message: `Order #${o.orderNumber || o.id} (${tableLabel}) delayed in kitchen — ${o.status} for ${minutes} min` });
      } else if (o.status === OrderStatus.READY && minutes >= 5) {
        alerts.push({ orderId: o.id, side: 'waiter', severity: minutes >= 15 ? 'critical' : 'warning', status: o.status, minutes, message: `Order #${o.orderNumber || o.id} (${tableLabel}) ready but not served for ${minutes} min${waiterName ? ` — waiter ${waiterName}` : ''}` });
      }
    }
    return alerts.sort((a, b) => b.minutes - a.minutes);
  }

  async getDashboardStats(branchId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const qb = this.orderRepo.createQueryBuilder('order')
      .where('order.createdAt >= :today', { today })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    const todayOrders = await qb.getMany();

    const totalRevenue = todayOrders
      .filter(o => o.status === OrderStatus.PAID)
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const scope = branchId ? { branchId } : {};
    const pendingOrders = await this.orderRepo.count({ where: { status: OrderStatus.PENDING, ...scope } });
    const preparingOrders = await this.orderRepo.count({ where: { status: OrderStatus.PREPARING, ...scope } });

    return {
      todayOrders: todayOrders.length,
      todayRevenue: totalRevenue,
      pendingOrders,
      preparingOrders,
    };
  }
}
