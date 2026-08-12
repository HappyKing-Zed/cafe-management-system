import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { RestaurantTable } from '../../entities/table.entity';
import { User } from '../../entities/user.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { TableStatus } from '../../common/enums/table-status.enum';
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
  ) {}

  findAll(status?: OrderStatus, tableId?: number, waiterId?: number, branchId?: number) {
    const where: any = {};
    if (status) where.status = status;
    if (tableId) where.tableId = tableId;
    if (waiterId) where.waiterId = waiterId;
    if (branchId) where.branchId = branchId;
    return this.orderRepo.find({
      where,
      relations: ['table', 'waiter', 'items', 'items.menuItem', 'payments'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const o = await this.orderRepo.findOne({
      where: { id },
      relations: ['table', 'waiter', 'items', 'items.menuItem', 'payments'],
    });
    if (!o) throw new NotFoundException('Order not found');
    return o;
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
    return order;
  }

  async create(data: { tableId?: number; waiterId?: number; notes?: string; customerName?: string; guestCount?: number; items?: Array<{ menuItemId: number; quantity: number; notes?: string }> }, creator?: { id: number; role: string; branchId?: number }) {
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
      guestCount: data.guestCount || 1,
      status: OrderStatus.PENDING,
    });

    if (data.items && data.items.length > 0) {
      let total = 0;
      const orderItems: OrderItem[] = [];
      for (const item of data.items) {
        const menuItem = await this.menuRepo.findOne({ where: { id: item.menuItemId } });
        if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
        const oi = this.itemRepo.create({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          notes: item.notes,
        });
        orderItems.push(oi);
        total += Number(menuItem.price) * item.quantity;
      }
      order.items = orderItems;
      order.totalAmount = total;
    }

    const saved = await this.orderRepo.save(order);

    // Mark table as occupied
    if (data.tableId) {
      await this.tableRepo.update(data.tableId, { status: TableStatus.OCCUPIED });
    }

    const full = await this.findOne(saved.id);
    await this.notifications.orderEvent(full, 'created');
    return full;
  }

  async addItems(orderId: number, items: Array<{ menuItemId: number; quantity: number; notes?: string }>, user?: { id: number; role: string }) {
    const order = await this.findOne(orderId);
    this.assertCanAccess(order, user);
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a paid or cancelled order');
    }

    for (const item of items) {
      const menuItem = await this.menuRepo.findOne({ where: { id: item.menuItemId } });
      if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
      
      const existing = order.items.find(i => i.menuItemId === item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
        await this.itemRepo.save(existing);
      } else {
        const oi = this.itemRepo.create({
          orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          notes: item.notes,
        });
        await this.itemRepo.save(oi);
      }
    }

    // Recalculate total
    const updated = await this.findOne(orderId);
    const total = updated.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    await this.orderRepo.update(orderId, { totalAmount: total });
    return this.findOne(orderId);
  }

  async removeItems(orderId: number, orderItemIds: number[], user?: { id: number; role: string }) {
    const order = await this.findOne(orderId);
    this.assertCanAccess(order, user);
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a paid or cancelled order');
    }
    // Waiters may only remove items before the kitchen starts preparing
    if (user?.role === 'waiter' && ![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(order.status)) {
      throw new ForbiddenException('Items can no longer be removed once the kitchen starts preparing');
    }
    const toRemove = order.items.filter(i => orderItemIds.includes(i.id));
    if (toRemove.length === 0) throw new BadRequestException('No matching items on this order');

    if (toRemove.length >= order.items.length) {
      // Removing everything cancels the order
      return this.updateStatus(orderId, OrderStatus.CANCELLED, user);
    }
    await this.itemRepo.remove(toRemove);
    const updated = await this.findOne(orderId);
    const total = updated.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    await this.orderRepo.update(orderId, { totalAmount: total });
    return this.findOne(orderId);
  }

  // Which statuses each role may set. Managers/admin/owner/coordinator: any.
  private static readonly ROLE_STATUS: Record<string, OrderStatus[]> = {
    waiter: [OrderStatus.SERVED, OrderStatus.CANCELLED],
    chef: [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY],
    cashier: [OrderStatus.PAID, OrderStatus.CANCELLED],
    storekeeper: [],
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

  async updateStatus(id: number, status: OrderStatus, user?: { id: number; role: string }) {
    if (user) {
      const existing = await this.findOne(id);
      this.assertCanAccess(existing, user);
      const allowed = OrdersService.ROLE_STATUS[user.role];
      if (allowed && !allowed.includes(status)) {
        throw new ForbiddenException(`Your role cannot set an order to "${status}"`);
      }
      // Only the cashier (or admin/owner) may confirm payment
      if (status === OrderStatus.PAID && !['cashier', 'admin', 'owner'].includes(user.role)) {
        throw new ForbiddenException('Only the cashier can confirm payment');
      }
      // Waiters may only cancel before the kitchen starts preparing
      if (
        user.role === 'waiter' &&
        status === OrderStatus.CANCELLED &&
        ![OrderStatus.PENDING, OrderStatus.CONFIRMED].includes(existing.status)
      ) {
        throw new ForbiddenException('Orders can no longer be cancelled once the kitchen starts preparing');
      }
    }
    const before = await this.findOne(id);
    if (before.status !== status && !OrdersService.TRANSITIONS[before.status]?.includes(status)) {
      throw new BadRequestException(`Cannot move an order from "${before.status}" to "${status}"`);
    }
    await this.orderRepo.update(id, { status });
    const order = await this.findOne(id);
    if (before.status !== status) await this.notifications.orderEvent(order, status);

    // Free table when order is paid/cancelled
    if ((status === OrderStatus.PAID || status === OrderStatus.CANCELLED) && order.tableId) {
      await this.tableRepo.update(order.tableId, { status: TableStatus.CLEANING });
    }
    return order;
  }

  async remove(id: number) {
    const o = await this.findOne(id);
    return this.orderRepo.remove(o);
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
        alerts.push({ orderId: o.id, side: 'kitchen', severity: minutes >= 15 ? 'critical' : 'warning', status: o.status, minutes, message: `Order #${o.id} (${tableLabel}) waiting for kitchen confirmation for ${minutes} min` });
      } else if ((o.status === OrderStatus.CONFIRMED || o.status === OrderStatus.PREPARING) && minutes >= 20) {
        alerts.push({ orderId: o.id, side: 'kitchen', severity: minutes >= 35 ? 'critical' : 'warning', status: o.status, minutes, message: `Order #${o.id} (${tableLabel}) delayed in kitchen — ${o.status} for ${minutes} min` });
      } else if (o.status === OrderStatus.READY && minutes >= 5) {
        alerts.push({ orderId: o.id, side: 'waiter', severity: minutes >= 15 ? 'critical' : 'warning', status: o.status, minutes, message: `Order #${o.id} (${tableLabel}) ready but not served for ${minutes} min${waiterName ? ` — waiter ${waiterName}` : ''}` });
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
