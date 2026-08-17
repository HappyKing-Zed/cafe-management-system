import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { ServiceSubmission, SubmissionStatus } from '../../entities/service-submission.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

export type SummaryPeriod = 'daily' | 'weekly' | 'monthly' | 'annual';

function periodStart(period: SummaryPeriod): Date {
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (period === 'weekly') {
    // Week starts on Monday
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
  } else if (period === 'monthly') {
    d.setDate(1);
  } else if (period === 'annual') {
    d.setMonth(0, 1);
  }
  return d;
}

// The order workflow is complete once the waiter serves it; paid orders stay counted.
const DONE_STATUSES = [OrderStatus.SERVED, OrderStatus.PAID];

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(ServiceSubmission) private subRepo: Repository<ServiceSubmission>,
    private notifications: NotificationsService,
  ) {}

  /** Served-items & revenue summary with per-table detail. */
  async getSummary(period: SummaryPeriod, waiterId?: number, branchId?: number) {
    const where: any = {
      status: In(DONE_STATUSES),
      updatedAt: MoreThanOrEqual(periodStart(period)),
    };
    if (waiterId) where.waiterId = waiterId;
    if (branchId) where.branchId = branchId;

    const orders = await this.orderRepo.find({
      where,
      relations: ['table', 'waiter', 'items', 'items.menuItem'],
      order: { updatedAt: 'DESC' },
    });

    const totals = { orders: 0, items: 0, revenue: 0 };
    const byTable = new Map<string, any>();
    const byWaiter = new Map<number, any>();

    for (const o of orders) {
      const itemCount = (o.items || []).reduce((s, i) => s + i.quantity, 0);
      const revenue = Number(o.totalAmount) || 0;
      totals.orders += 1;
      totals.items += itemCount;
      totals.revenue += revenue;

      const tKey = o.table ? `T${o.table.id}` : 'walkin';
      if (!byTable.has(tKey)) {
        byTable.set(tKey, {
          tableId: o.table?.id ?? null,
          tableNumber: o.table?.number ?? null,
          label: o.table ? `Table ${o.table.number}` : 'Walk-in / Takeaway',
          orders: 0,
          items: 0,
          revenue: 0,
          itemDetail: new Map<number, any>(),
        });
      }
      const t = byTable.get(tKey);
      t.orders += 1;
      t.items += itemCount;
      t.revenue += revenue;
      for (const i of o.items || []) {
        const key = i.menuItemId;
        if (!t.itemDetail.has(key)) {
          t.itemDetail.set(key, { menuItemId: key, name: i.menuItem?.name || `Item #${key}`, quantity: 0, amount: 0 });
        }
        const d = t.itemDetail.get(key);
        d.quantity += i.quantity;
        d.amount += Number(i.unitPrice) * i.quantity;
      }

      if (o.waiterId) {
        if (!byWaiter.has(o.waiterId)) {
          byWaiter.set(o.waiterId, { waiterId: o.waiterId, name: o.waiter?.name || `Waiter #${o.waiterId}`, orders: 0, items: 0, revenue: 0 });
        }
        const w = byWaiter.get(o.waiterId);
        w.orders += 1;
        w.items += itemCount;
        w.revenue += revenue;
      }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      period,
      from: periodStart(period),
      totals: { ...totals, revenue: round(totals.revenue) },
      byTable: [...byTable.values()]
        .map((t) => ({ ...t, revenue: round(t.revenue), itemDetail: [...t.itemDetail.values()].map((d: any) => ({ ...d, amount: round(d.amount) })).sort((a: any, b: any) => b.quantity - a.quantity) }))
        .sort((a, b) => b.revenue - a.revenue),
      byWaiter: [...byWaiter.values()].map((w) => ({ ...w, revenue: round(w.revenue) })).sort((a, b) => b.revenue - a.revenue),
    };
  }

  /** Waiter submits today's service report to the cashier (one per day, resubmit updates until confirmed). */
  async submitDaily(waiter: { id: number; branchId?: number }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const serviceDate = today.toISOString().slice(0, 10);

    const whereOrders: any = { waiterId: waiter.id, status: In(DONE_STATUSES), updatedAt: MoreThanOrEqual(today) };
    if (waiter.branchId) whereOrders.branchId = waiter.branchId;
    const orders = await this.orderRepo.find({
      where: whereOrders,
      relations: ['table', 'items', 'items.menuItem'],
      order: { updatedAt: 'ASC' },
    });
    if (orders.length === 0) throw new BadRequestException('No served orders today — nothing to submit yet');

    const detail = orders.map((o) => ({
      orderId: o.id,
      table: o.table ? `Table ${o.table.number}` : (o.customerName || 'Walk-in'),
      status: o.status,
      amount: Number(o.totalAmount) || 0,
      items: (o.items || []).map((i) => ({ name: i.menuItem?.name || `Item #${i.menuItemId}`, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
    }));
    const totalRevenue = Math.round(detail.reduce((s, d) => s + d.amount, 0) * 100) / 100;
    const itemsCount = orders.reduce((s, o) => s + (o.items || []).reduce((x, i) => x + i.quantity, 0), 0);

    let sub = await this.subRepo.findOne({ where: { waiterId: waiter.id, serviceDate } });
    if (sub && sub.status === SubmissionStatus.CONFIRMED) {
      throw new BadRequestException('Today\'s submission was already confirmed by the cashier');
    }
    if (!sub) {
      sub = this.subRepo.create({ waiterId: waiter.id, serviceDate, branchId: waiter.branchId || undefined });
    }
    sub.ordersCount = orders.length;
    sub.itemsCount = itemsCount;
    sub.totalRevenue = totalRevenue;
    sub.detail = detail;
    sub.status = SubmissionStatus.SUBMITTED;
    try {
      await this.subRepo.save(sub);
    } catch (e: any) {
      // Unique (waiterId, serviceDate) hit by a concurrent submit — update the existing row instead
      if (e?.code === '23505') {
        const existing = await this.subRepo.findOne({ where: { waiterId: waiter.id, serviceDate } });
        if (!existing) throw e;
        if (existing.status === SubmissionStatus.CONFIRMED) {
          throw new BadRequestException('Today\'s submission was already confirmed by the cashier');
        }
        await this.subRepo.update(existing.id, {
          ordersCount: sub.ordersCount, itemsCount: sub.itemsCount, totalRevenue: sub.totalRevenue,
          detail: sub.detail, status: SubmissionStatus.SUBMITTED,
        });
        sub = existing;
      } else {
        throw e;
      }
    }
    const saved = await this.subRepo.findOne({ where: { id: sub.id }, relations: ['waiter', 'cashier'] });

    // Notify cashiers and managers in the same branch that a report was submitted
    const waiterName = saved?.waiter?.name || `Waiter #${waiter.id}`;
    await this.notifications.notify({
      roles: ['cashier', 'manager'],
      message: `${waiterName} submitted a daily service report for ${serviceDate}`,
      branchId: waiter.branchId ?? null,
    });

    return saved;
  }

  async listSubmissions(user: { id: number; role: string; branchId?: number }, waiterId?: number, branchId?: number) {
    const where: any = {};
    if (user.role === 'waiter') {
      where.waiterId = user.id;
      if (branchId) where.branchId = branchId;
    } else {
      if (waiterId) where.waiterId = waiterId;
      if (branchId) where.branchId = branchId;
    }
    return this.subRepo.find({ where, relations: ['waiter', 'cashier'], order: { serviceDate: 'DESC', createdAt: 'DESC' }, take: 100 });
  }

  async confirm(id: number, cashier: { id: number; role: string; branchId?: number }) {
    const sub = await this.subRepo.findOne({ where: { id }, relations: ['waiter'] });
    if (!sub) throw new NotFoundException('Submission not found');
    // Fail closed: non-global roles may only confirm submissions from their own branch
    if (!['admin', 'owner'].includes(cashier.role) && (!cashier.branchId || sub.branchId !== cashier.branchId)) {
      throw new ForbiddenException('This submission belongs to another branch');
    }
    if (sub.status === SubmissionStatus.CONFIRMED) return sub;
    sub.status = SubmissionStatus.CONFIRMED;
    sub.cashierId = cashier.id;
    sub.confirmedAt = new Date();
    await this.subRepo.save(sub);
    const confirmed = await this.subRepo.findOne({ where: { id }, relations: ['waiter', 'cashier'] });

    // Notify the waiter that their daily report has been confirmed
    if (sub.waiterId) {
      const cashierName = confirmed?.cashier?.name || `Cashier #${cashier.id}`;
      await this.notifications.notify({
        userId: sub.waiterId,
        message: `${cashierName} confirmed your daily service report for ${sub.serviceDate}`,
        branchId: sub.branchId ?? null,
      });
    }

    return confirmed;
  }
}
