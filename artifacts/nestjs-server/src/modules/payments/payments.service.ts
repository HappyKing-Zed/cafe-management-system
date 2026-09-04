import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { Shift } from '../../entities/shift.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { RestaurantTable } from '../../entities/table.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { TableStatus } from '../../common/enums/table-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private notifications: NotificationsService,
    @InjectRepository(Payment) private payRepo: Repository<Payment>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private dataSource: DataSource,
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
    if (actorRole && !['cashier', 'admin', 'owner'].includes(actorRole)) {
      throw new ForbiddenException('Only a cashier can confirm payment');
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id: data.orderId })
        .getOne();
      if (!order) throw new NotFoundException('Order not found');
      // Acquire the shared serialization lock without an outer join, then load
      // items separately through this transaction's manager.
      order.items = await manager.getRepository(OrderItem).find({ where: { orderId: order.id } });
      if (branchId && order.branchId && order.branchId !== branchId) {
        throw new ForbiddenException('This order belongs to another branch');
      }
      if (order.status === OrderStatus.PAID) throw new BadRequestException('Order already paid');
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');
      // A null item status is only valid legacy data on an already-served order.
      if (order.status !== OrderStatus.SERVED || order.items.some((item) => item.status && item.status !== 'served')) {
        throw new BadRequestException('Only fully served orders can be paid');
      }
      if (Number(data.amount) < Number(order.totalAmount)) {
        throw new BadRequestException('Amount received is less than the order total');
      }
      const change = Number(data.amount) - Number(order.totalAmount);
      const payment = manager.getRepository(Payment).create({
        orderId: data.orderId, method: data.method, amount: data.amount,
        changeGiven: change > 0 ? change : 0, cashierId: cashierUserId ?? data.cashierId,
        reference: data.reference,
      });
      await manager.getRepository(Payment).save(payment);
      await manager.getRepository(Order).update(data.orderId, { status: OrderStatus.PAID });
      if (order.tableId) {
        await manager.getRepository(RestaurantTable).update(order.tableId, { status: TableStatus.CLEANING });
      }
      return payment;
    });
    const full = await this.orderRepo.findOne({ where: { id: data.orderId }, relations: ['table', 'waiter'] });
    if (full) await this.notifications.orderEvent(full, OrderStatus.PAID);
    return result;
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
