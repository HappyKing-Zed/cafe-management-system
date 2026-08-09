import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private repo: Repository<Notification>) {}

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

  /** Create notifications for an order lifecycle event. */
  async orderEvent(order: Order, event: 'created' | OrderStatus) {
    const tableLabel = order.table?.number ? `Table ${order.table.number}` : order.customerName || 'Walk-in';
    const waiter = order.waiter?.name ? ` — waiter ${order.waiter.name}` : '';
    const base = { orderId: order.id, branchId: order.branchId ?? null } as any;
    const rows: Array<Partial<Notification>> = [];
    const toWaiter = (message: string) => {
      if (order.waiterId) rows.push({ ...base, targetUserId: order.waiterId, message });
    };
    const toRoles = (roles: string[], message: string) => {
      for (const r of roles) rows.push({ ...base, targetRole: r, message });
    };

    switch (event) {
      case 'created':
        toRoles(['chef', 'coordinator'], `New order #${order.id} (${tableLabel})${waiter} — waiting for kitchen`);
        break;
      case OrderStatus.CONFIRMED:
        toWaiter(`Order #${order.id} (${tableLabel}) was received by the kitchen`);
        break;
      case OrderStatus.PREPARING:
        toWaiter(`Order #${order.id} (${tableLabel}) is now being prepared`);
        break;
      case OrderStatus.READY:
        toWaiter(`Order #${order.id} (${tableLabel}) is READY — please serve it`);
        toRoles(['coordinator'], `Order #${order.id} (${tableLabel})${waiter} is ready for serving`);
        break;
      case OrderStatus.SERVED:
        toRoles(['cashier'], `Order #${order.id} (${tableLabel})${waiter} was served — awaiting payment`);
        break;
      case OrderStatus.PAID:
        toWaiter(`Order #${order.id} (${tableLabel}) has been paid — completed`);
        toRoles(['manager'], `Order #${order.id} (${tableLabel})${waiter} completed and paid`);
        break;
      case OrderStatus.CANCELLED:
        toWaiter(`Order #${order.id} (${tableLabel}) was cancelled`);
        toRoles(['chef', 'coordinator'], `Order #${order.id} (${tableLabel}) was cancelled`);
        break;
    }
    await this.push(rows);
  }
}
