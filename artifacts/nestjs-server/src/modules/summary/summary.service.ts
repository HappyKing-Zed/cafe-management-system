import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual, Between } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { ServiceSubmission, SubmissionStatus } from '../../entities/service-submission.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

export type SummaryPeriod = 'daily' | 'weekly' | 'monthly' | 'annual';

// Business timezone: Ethiopia (Africa/Addis Ababa / Nairobi), UTC+3, no DST.
// All calendar-date boundaries are interpreted in this timezone so results
// don't depend on the server's own timezone.
const BUSINESS_TZ_OFFSET = '+03:00';
const BUSINESS_TZ = 'Africa/Nairobi';

/** Midnight (start of day) of a YYYY-MM-DD calendar date in the business timezone. */
function dayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00${BUSINESS_TZ_OFFSET}`);
}

/** Exclusive end boundary: midnight of the NEXT day in the business timezone. */
function nextDayStart(dateStr: string): Date {
  const d = dayStart(dateStr);
  d.setDate(d.getDate() + 1);
  return d;
}

/** Today's calendar date (YYYY-MM-DD) in the business timezone. */
function businessToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function periodStart(period: SummaryPeriod): Date {
  const today = businessToday();
  const d = dayStart(today);
  if (period === 'weekly') {
    // Week starts on Monday (weekday computed from the business-tz calendar date)
    const [y, m, dd] = today.split('-').map(Number);
    const local = new Date(Date.UTC(y, m - 1, dd));
    const localDay = (local.getUTCDay() + 6) % 7;
    local.setUTCDate(local.getUTCDate() - localDay);
    return dayStart(local.toISOString().slice(0, 10));
  } else if (period === 'monthly') {
    return dayStart(`${today.slice(0, 7)}-01`);
  } else if (period === 'annual') {
    return dayStart(`${today.slice(0, 4)}-01-01`);
  }
  return d;
}

// Stable stringify (sorted keys) — Postgres jsonb does not preserve key order,
// so a naive JSON.stringify comparison would flag identical reports as changed.
function stableStringify(v: any): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
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

  /** Served-items & revenue summary with per-table detail, filtered by a calendar date range. */
  async getSummary(range: { startDate?: string; endDate?: string; period?: SummaryPeriod }, waiterId?: number, branchId?: number) {
    let from: Date;
    let toExclusive: Date | undefined;
    if (range.startDate && /^\d{4}-\d{2}-\d{2}$/.test(range.startDate)) {
      from = dayStart(range.startDate);
      let endStr = range.endDate && /^\d{4}-\d{2}-\d{2}$/.test(range.endDate) ? range.endDate : range.startDate;
      if (endStr < range.startDate) endStr = range.startDate;
      toExclusive = nextDayStart(endStr);
    } else {
      from = periodStart(range.period || 'daily');
    }
    const where: any = {
      status: In(DONE_STATUSES),
      // Half-open interval [from, toExclusive) in the business timezone
      updatedAt: toExclusive ? Between(from, new Date(toExclusive.getTime() - 1)) : MoreThanOrEqual(from),
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
      from,
      to: toExclusive ?? new Date(),
      totals: { ...totals, revenue: round(totals.revenue) },
      byTable: [...byTable.values()]
        .map((t) => ({ ...t, revenue: round(t.revenue), itemDetail: [...t.itemDetail.values()].map((d: any) => ({ ...d, amount: round(d.amount) })).sort((a: any, b: any) => b.quantity - a.quantity) }))
        .sort((a, b) => b.revenue - a.revenue),
      byWaiter: [...byWaiter.values()].map((w) => ({ ...w, revenue: round(w.revenue) })).sort((a, b) => b.revenue - a.revenue),
    };
  }

  /** Waiter submits today's service report to the cashier (one per day, resubmit updates until confirmed). */
  async submitDaily(waiter: { id: number; branchId?: number }) {
    const serviceDate = businessToday();
    const today = dayStart(serviceDate);

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
    if (!sub) {
      sub = this.subRepo.create({ waiterId: waiter.id, serviceDate, branchId: waiter.branchId || undefined });
    } else {
      // Resubmission: keep the previous version so it can be compared with the new one
      const changed = stableStringify(sub.detail) !== stableStringify(detail)
        || Number(sub.totalRevenue) !== totalRevenue || sub.ordersCount !== orders.length || sub.itemsCount !== itemsCount;
      if (!changed && sub.status === SubmissionStatus.CONFIRMED) {
        throw new BadRequestException('Nothing changed since the cashier confirmed this report');
      }
      if (changed) {
        sub.revisions = [
          ...(Array.isArray(sub.revisions) ? sub.revisions : []),
          {
            submittedAt: (sub.updatedAt || sub.createdAt || new Date()).toISOString?.() || sub.updatedAt,
            ordersCount: sub.ordersCount,
            itemsCount: sub.itemsCount,
            totalRevenue: Number(sub.totalRevenue),
            detail: sub.detail,
            wasConfirmed: sub.status === SubmissionStatus.CONFIRMED,
            confirmedAt: sub.confirmedAt || null,
          },
        ];
        // A resubmission after confirmation goes back to the cashier for a fresh confirmation
        sub.cashierId = null as any;
        sub.confirmedAt = null as any;
      }
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
