import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { Shift } from '../../entities/shift.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private notifications: NotificationsService,
    @InjectRepository(Payment) private payRepo: Repository<Payment>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  findAll(cashierId?: number, branchId?: number) {
    const qb = this.payRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.order', 'order')
      .leftJoinAndSelect('p.cashier', 'cashier')
      .orderBy('p.createdAt', 'DESC');
    if (cashierId) qb.andWhere('p.cashierId = :cashierId', { cashierId });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    return qb.getMany();
  }

  async processPayment(data: { orderId: number; method: any; amount: number; cashierId?: number; reference?: string }, branchId?: number, cashierUserId?: number, actorRole?: string) {
    const order = await this.orderRepo.findOne({ where: { id: data.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (branchId && order.branchId && order.branchId !== branchId) {
      throw new ForbiddenException('This order belongs to another branch');
    }
    // Waiters may only take payment for their own orders
    if (actorRole === 'waiter' && order.waiterId !== cashierUserId) {
      throw new ForbiddenException('You can only take payment for your own orders');
    }
    if (order.status === OrderStatus.PAID) throw new BadRequestException('Order already paid');
    if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');
    if (Number(data.amount) < Number(order.totalAmount)) {
      throw new BadRequestException('Amount received is less than the order total');
    }

    // Atomically flip the order to PAID; if another request beat us, refuse (prevents double payment)
    const flip = await this.orderRepo
      .createQueryBuilder()
      .update()
      .set({ status: OrderStatus.PAID })
      .where('id = :id AND status != :paid', { id: data.orderId, paid: OrderStatus.PAID })
      .execute();
    if (!flip.affected) throw new BadRequestException('Order already paid');

    const change = Number(data.amount) - Number(order.totalAmount);
    const payment = this.payRepo.create({
      orderId: data.orderId,
      method: data.method,
      amount: data.amount,
      changeGiven: change > 0 ? change : 0,
      cashierId: cashierUserId ?? data.cashierId,
      reference: data.reference,
    });
    await this.payRepo.save(payment);
    const full = await this.orderRepo.findOne({ where: { id: data.orderId }, relations: ['table', 'waiter'] });
    if (full) await this.notifications.orderEvent(full, OrderStatus.PAID);
    return payment;
  }

  // Shifts
  findShifts(cashierId?: number, branchId?: number) {
    const where: any = {};
    if (cashierId) where.cashierId = cashierId;
    if (branchId) where.branchId = branchId;
    return this.shiftRepo.find({ where, relations: ['cashier', 'branch'], order: { openedAt: 'DESC' } });
  }

  openShift(data: { cashierId: number; branchId: number; openingCash: number }, branchId?: number) {
    if (branchId) data.branchId = branchId;
    const shift = this.shiftRepo.create({ ...data, isOpen: true });
    return this.shiftRepo.save(shift);
  }

  async closeShift(id: number, closingCash: number, branchId?: number) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (branchId && shift.branchId && shift.branchId !== branchId) {
      throw new ForbiddenException('This shift belongs to another branch');
    }
    shift.isOpen = false;
    shift.closingCash = closingCash;
    shift.closedAt = new Date();
    return this.shiftRepo.save(shift);
  }

  async getDailyReport(fromDate?: string, branchId?: number, toDate?: string, method?: string) {
    const startDate = fromDate ? new Date(`${fromDate}T00:00:00`) : new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = toDate ? new Date(`${toDate}T23:59:59.999`) : new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid sales report date');
    }
    if (startDate > endDate) {
      throw new BadRequestException('The sales report start date must be on or before the end date');
    }

    const qb = this.payRepo.createQueryBuilder('p')
      .leftJoin('p.order', 'order')
      .where('p.createdAt >= :start', { start: startDate })
      .andWhere('p.createdAt <= :end', { end: endDate });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    if (method && method !== 'all') qb.andWhere('p.method = :method', { method });
    const payments = await qb.getMany();

    const byMethod = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      from: startDate,
      to: endDate,
      totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      transactionCount: payments.length,
      byMethod,
    };
  }
}
