import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { InventoryItem } from '../../entities/inventory-item.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    @InjectRepository(InventoryItem) private itemRepo: Repository<InventoryItem>,
  ) {}

  /** Notifications relevant to the current user: targeted directly, or by role within their branch. */
  findForUser(user: { id: number; role: string; branchId?: number }) {
    const branchMatch = user.branchId ? [{ branchId: user.branchId }, { branchId: IsNull() }] : [{}];
    const where: any[] = [];
    for (const b of branchMatch) {
      where.push({ targetUserId: user.id, ...b });
      where.push({ targetRole: user.role, ...b });
    }
    return this.repo.find({ where, order: { createdAt: 'DESC' }, take: 30 });
  }

  async markAllRead(user: { id: number; role: string; branchId?: number }) {
    const items = await this.findForUser(user);
    const ids = items.filter((n) => !n.isRead).map((n) => n.id);
    if (ids.length) await this.repo.update({ id: In(ids) }, { isRead: true });
    return { updated: ids.length };
  }

  private async push(rows: Array<Partial<Notification>>) {
    if (rows.length) await this.repo.save(rows.map((r) => this.repo.create(r)));
  }

  /** Notify one or more roles (and/or a specific user) about an inventory event. */
  async notify(opts: { roles?: string[]; userId?: number; message: string; branchId?: number | null }) {
    const base = { branchId: opts.branchId ?? null } as any;
    const rows: Array<Partial<Notification>> = [];
    for (const r of opts.roles || []) rows.push({ ...base, targetRole: r, message: opts.message });
    if (opts.userId) rows.push({ ...base, targetUserId: opts.userId, message: opts.message });
    await this.push(rows);
  }

  /**
   * Scan inventory for low-stock and expiring/expired items and create alerts
   * for storekeeper + manager. Deduplicates: skips when an identical unread
   * notification already exists.
   */
  async scanInventoryAlerts(branchId?: number) {
    const qb = this.itemRepo.createQueryBuilder('item')
      .where(`(item.currentStock <= item.minStock OR (item.expiryDate IS NOT NULL AND item.expiryDate <= (CURRENT_DATE + INTERVAL '7 days')))`);
    if (branchId) qb.andWhere('item.branchId = :bid', { bid: branchId });
    const items = await qb.getMany();
    if (!items.length) return;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const msgs: Array<{ message: string; branchId: number | null }> = [];
    for (const item of items) {
      if (Number(item.currentStock) <= Number(item.minStock)) {
        const out = Number(item.currentStock) <= 0;
        msgs.push({ message: `LOW STOCK: ${item.name} — ${out ? 'out of stock' : `${Number(item.currentStock)} ${item.unit} left (min ${Number(item.minStock)})`}`, branchId: item.branchId ?? null });
      }
      if (item.expiryDate) {
        const exp = new Date(item.expiryDate);
        if (exp < today) msgs.push({ message: `EXPIRED: ${item.name} expired on ${item.expiryDate} — remove from stock`, branchId: item.branchId ?? null });
        else msgs.push({ message: `EXPIRY WARNING: ${item.name} expires on ${item.expiryDate}`, branchId: item.branchId ?? null });
      }
    }

    const rows: Array<Partial<Notification>> = [];
    for (const m of msgs) {
      for (const role of ['branch_store_keeper', 'manager']) {
        const exists = await this.repo.findOne({ where: { message: m.message, targetRole: role, isRead: false, branchId: (m.branchId ?? IsNull()) as any } });
        if (!exists) rows.push({ message: m.message, targetRole: role, branchId: m.branchId as any });
      }
    }
    await this.push(rows);
  }

  /** Create notifications for an order lifecycle event. */
  async orderEvent(order: Order, event: 'created' | OrderStatus) {
    const tableLabel = order.table?.number ? `Table ${order.table.number}` : order.customerName || 'Walk-in';
    const waiter = order.waiter?.name ? ` — waiter ${order.waiter.name}` : '';
    const base = { orderId: order.id, branchId: order.branchId ?? null } as any;
    const orderLabel = order.orderNumber || order.id;
    const rows: Array<Partial<Notification>> = [];
    const toWaiter = (message: string) => {
      if (order.waiterId) rows.push({ ...base, targetUserId: order.waiterId, message });
    };
    const toRoles = (roles: string[], message: string) => {
      for (const r of roles) rows.push({ ...base, targetRole: r, message });
    };

    switch (event) {
      case 'created':
        toRoles(['coordinator'], `New order #${orderLabel} (${tableLabel})${waiter} — waiting for kitchen assignment`);
        break;
      case OrderStatus.CONFIRMED:
        toWaiter(`Order #${orderLabel} (${tableLabel}) was received by the kitchen`);
        break;
      case OrderStatus.PREPARING:
        toWaiter(`Order #${orderLabel} (${tableLabel}) is now being prepared`);
        break;
      case OrderStatus.READY:
        toWaiter(`Order #${orderLabel} (${tableLabel}) is READY — please serve it`);
        toRoles(['coordinator'], `Order #${orderLabel} (${tableLabel})${waiter} is ready for serving`);
        break;
      case OrderStatus.SERVED:
        toRoles(['cashier'], `Order #${orderLabel} (${tableLabel})${waiter} was served — awaiting payment`);
        break;
      case OrderStatus.PAID:
        toWaiter(`Order #${orderLabel} (${tableLabel}) has been paid — completed`);
        toRoles(['manager'], `Order #${orderLabel} (${tableLabel})${waiter} completed and paid`);
        break;
      case OrderStatus.CANCELLED:
        toWaiter(`Order #${orderLabel} (${tableLabel}) was cancelled`);
        toRoles(['coordinator'], `Order #${orderLabel} (${tableLabel}) was cancelled`);
        for (const workerId of new Set((order.items || []).map((item) => item.assignedKitchenWorkerId).filter(Boolean))) {
          rows.push({ ...base, targetUserId: workerId, message: `Order #${orderLabel} (${tableLabel}) was cancelled` });
        }
        break;
    }
    await this.push(rows);
  }
}
