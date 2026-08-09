import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { Shift } from '../../entities/shift.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private payRepo: Repository<Payment>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
  ) {}

  findAll(cashierId?: number) {
    const where: any = {};
    if (cashierId) where.cashierId = cashierId;
    return this.payRepo.find({ where, relations: ['order', 'cashier'], order: { createdAt: 'DESC' } });
  }

  async processPayment(data: { orderId: number; method: any; amount: number; cashierId?: number; reference?: string }) {
    const order = await this.orderRepo.findOne({ where: { id: data.orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === OrderStatus.PAID) throw new BadRequestException('Order already paid');

    const change = Number(data.amount) - Number(order.totalAmount);
    const payment = this.payRepo.create({
      orderId: data.orderId,
      method: data.method,
      amount: data.amount,
      changeGiven: change > 0 ? change : 0,
      cashierId: data.cashierId,
      reference: data.reference,
    });
    await this.payRepo.save(payment);
    await this.orderRepo.update(data.orderId, { status: OrderStatus.PAID });
    return payment;
  }

  // Shifts
  findShifts(cashierId?: number) {
    const where: any = {};
    if (cashierId) where.cashierId = cashierId;
    return this.shiftRepo.find({ where, relations: ['cashier', 'branch'], order: { openedAt: 'DESC' } });
  }

  openShift(data: { cashierId: number; branchId: number; openingCash: number }) {
    const shift = this.shiftRepo.create({ ...data, isOpen: true });
    return this.shiftRepo.save(shift);
  }

  async closeShift(id: number, closingCash: number) {
    const shift = await this.shiftRepo.findOne({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    shift.isOpen = false;
    shift.closingCash = closingCash;
    shift.closedAt = new Date();
    return this.shiftRepo.save(shift);
  }

  async getDailyReport(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const payments = await this.payRepo.createQueryBuilder('p')
      .where('p.createdAt >= :start', { start: targetDate })
      .andWhere('p.createdAt <= :end', { end: endDate })
      .getMany();

    const byMethod = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      date: targetDate,
      totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount), 0),
      transactionCount: payments.length,
      byMethod,
    };
  }
}
