import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../../entities/payment.entity';
import { PaymentItem } from '../../entities/payment-item.entity';
import { Shift } from '../../entities/shift.entity';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../../entities/user.entity';

@Injectable()
export class PaymentsService {
  constructor(
    private notifications: NotificationsService,
    @InjectRepository(Payment) private payRepo: Repository<Payment>,
    @InjectRepository(Shift) private shiftRepo: Repository<Shift>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async findAll(cashierId?: number, branchId?: number, actorRole?: string, actorId?: number) {
    if (actorRole && !['admin', 'owner'].includes(actorRole)) {
      const actor = actorId ? await this.userRepo.findOne({ where: { id: actorId } }) : null;
      branchId = actor?.branchId;
    }
    if (actorRole && !['admin', 'owner'].includes(actorRole) && !branchId) {
      throw new ForbiddenException('Payment records require a branch assignment');
    }
    const qb = this.payRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.order', 'order')
      .leftJoinAndSelect('p.paymentItems', 'paymentItems')
      .leftJoinAndSelect('paymentItems.orderItem', 'paidOrderItem')
      .leftJoinAndSelect('p.cashier', 'cashier')
      .orderBy('p.createdAt', 'DESC');
    if (cashierId) qb.andWhere('p.cashierId = :cashierId', { cashierId });
    if (branchId) qb.andWhere('order.branchId = :branchId', { branchId });
    return qb.getMany();
  }

  private itemAllocations(order: Order, items: OrderItem[]) {
    const sorted = [...items].sort((a, b) => a.id - b.id);
    const lineCents = sorted.map((item) => Math.round(Number(item.unitPrice) * item.quantity * 100));
    const subtotalCents = lineCents.reduce((sum, value) => sum + value, 0);
    const totalCents = Math.round(Number(order.totalAmount) * 100);
    if (subtotalCents <= 0) throw new BadRequestException('Order items have no payable value');

    const raw = lineCents.map((value) => totalCents * value / subtotalCents);
    const allocated = raw.map(Math.floor);
    let remainder = totalCents - allocated.reduce((sum, value) => sum + value, 0);
    const remainderOrder = raw
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction || sorted[a.index].id - sorted[b.index].id);
    for (let index = 0; index < remainder; index += 1) allocated[remainderOrder[index].index] += 1;

    return new Map(sorted.map((item, index) => [item.id, allocated[index] / 100]));
  }

  private async verifyWithShegerPay(data: {
    provider: string;
    transactionId: string;
    amount: number;
    phoneNumber?: string;
    senderAccount?: string;
    expectedSenderName?: string;
  }) {
    const apiKey = process.env.SHEGERPAY_API_KEY;
    if (!apiKey) throw new BadRequestException('ShegerPay verification is not configured');

    const provider = String(data.provider || '').trim().toLowerCase();
    const transactionId = String(data.transactionId || '').trim();
    if (!provider || !transactionId) {
      throw new BadRequestException('Provider and transaction ID are required for authenticity verification');
    }
    if (provider === 'mpesa' && !data.phoneNumber?.trim()) {
      throw new BadRequestException('Phone number is required for M-Pesa verification');
    }
    if (provider === 'boa' && !data.senderAccount?.trim()) {
      throw new BadRequestException('Sender account is required for Bank of Abyssinia verification');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    let body: any;
    try {
      response = await fetch('https://api.shegerpay.com/api/v1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          provider,
          transaction_id: transactionId,
          amount: data.amount,
          ...(data.phoneNumber?.trim() ? { phone_number: data.phoneNumber.trim() } : {}),
          ...(data.senderAccount?.trim() ? { sender_account: data.senderAccount.trim() } : {}),
          ...(data.expectedSenderName?.trim() ? { expected_sender_name: data.expectedSenderName.trim() } : {}),
        }),
        signal: controller.signal,
      });
      body = await response.json().catch(() => ({}));
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new BadRequestException('ShegerPay verification timed out. Payment was not confirmed');
      }
      throw new BadRequestException('ShegerPay verification is temporarily unavailable. Payment was not confirmed');
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const messages: Record<number, string> = {
        400: 'ShegerPay could not verify these payment details',
        401: 'ShegerPay authentication failed. Contact an administrator',
        402: 'ShegerPay verification quota is unavailable',
        404: 'ShegerPay verification endpoint was not found. Contact an administrator',
        429: 'Too many verification attempts. Please wait and try again',
        503: 'ShegerPay is temporarily unavailable. Payment was not confirmed',
      };
      throw new BadRequestException(messages[response.status] || body?.message || 'Payment authenticity verification failed');
    }
    if (body?.verified !== true) {
      throw new BadRequestException(`Payment was not verified by ShegerPay${body?.status ? ` (${body.status})` : ''}`);
    }
    return body;
  }

  async processPayment(data: {
    orderId: number;
    orderItemIds?: number[];
    method: any;
    amount: number;
    cashierId?: number;
    reference?: string;
    authenticityVerification?: {
      enabled: boolean;
      provider: string;
      transactionId: string;
      phoneNumber?: string;
      senderAccount?: string;
      expectedSenderName?: string;
    };
  }, branchId?: number, cashierUserId?: number, actorRole?: string) {
    if (actorRole && !['cashier', 'admin', 'owner'].includes(actorRole)) {
      throw new ForbiddenException('Only a cashier can confirm payment');
    }
    const result = await this.dataSource.transaction(async (manager) => {
      const order = await manager.getRepository(Order).createQueryBuilder('order')
        .setLock('pessimistic_write')
        .where('order.id = :id', { id: data.orderId })
        .getOne();
      if (!order) throw new NotFoundException('Order not found');
      if (actorRole && !['admin', 'owner'].includes(actorRole)) {
        const actor = cashierUserId ? await manager.getRepository(User).findOne({ where: { id: cashierUserId } }) : null;
        branchId = actor?.branchId;
        if (!branchId) throw new ForbiddenException('Payment confirmation requires a branch assignment');
      }
      // Acquire the shared serialization lock without an outer join, then load
      // items separately through this transaction's manager.
      order.items = await manager.getRepository(OrderItem).find({ where: { orderId: order.id } });
      const existingLinks = order.items.length
        ? await manager.getRepository(PaymentItem).createQueryBuilder('paymentItem')
          .where('paymentItem.orderItemId IN (:...itemIds)', { itemIds: order.items.map((item) => item.id) })
          .getMany()
        : [];
      const paidItemIds = new Set(existingLinks.map((link) => link.orderItemId));
      if (branchId && order.branchId !== branchId) {
        throw new ForbiddenException('This order belongs to another branch');
      }
      if (order.status === OrderStatus.PAID) throw new BadRequestException('Order already paid');
      if (order.status === OrderStatus.CANCELLED) throw new BadRequestException('Order is cancelled');
      const requestedIds = data.orderItemIds?.length
        ? data.orderItemIds.map(Number)
        : order.items.filter((item) => item.status === 'served' && !paidItemIds.has(item.id)).map((item) => item.id);
      if (!requestedIds.length || requestedIds.some((id) => !Number.isInteger(id) || id <= 0)) {
        throw new BadRequestException('Select at least one served item to pay');
      }
      if (new Set(requestedIds).size !== requestedIds.length) {
        throw new BadRequestException('Each item may only be selected once');
      }
      const selectedItems = requestedIds.map((id) => order.items.find((item) => item.id === id));
      if (selectedItems.some((item) => !item)) throw new BadRequestException('A selected item does not belong to this order');
      if (selectedItems.some((item) => item!.status !== 'served')) throw new BadRequestException('Only served items can be paid');
      if (requestedIds.some((id) => paidItemIds.has(id))) throw new BadRequestException('A selected item is already paid');

      const allocations = this.itemAllocations(order, order.items);
      const paymentTotal = Math.round(selectedItems.reduce((sum, item) => sum + (allocations.get(item!.id) || 0), 0) * 100) / 100;
      if (Number(data.amount) < paymentTotal) {
        throw new BadRequestException('Amount received is less than the selected total');
      }
      let verification: any = null;
      const verificationInput = data.authenticityVerification;
      if (verificationInput?.enabled) {
        if (data.method === 'cash') throw new BadRequestException('Cash payments cannot use electronic authenticity verification');
        const transactionId = String(verificationInput.transactionId || '').trim();
        const existing = transactionId
          ? await manager.getRepository(Payment).findOne({ where: { reference: transactionId, authenticityVerified: true } })
          : null;
        if (existing) throw new BadRequestException('This transaction ID has already been used for a verified payment');
        verification = await this.verifyWithShegerPay({
          ...verificationInput,
          transactionId,
          amount: paymentTotal,
        });
      }
      const change = Number(data.amount) - paymentTotal;
      const payment = manager.getRepository(Payment).create({
        orderId: data.orderId, method: data.method, amount: paymentTotal,
        changeGiven: change > 0 ? change : 0, cashierId: cashierUserId ?? data.cashierId,
        reference: verificationInput?.enabled ? verificationInput.transactionId.trim() : data.reference,
        authenticityVerified: verification?.verified === true,
        verificationProvider: verificationInput?.enabled ? verificationInput.provider : null,
        verificationStatus: verification?.status || null,
        verificationMode: verification?.mode || null,
        verificationRequestId: verification?.request_id || null,
        verificationReferenceId: verification?.reference_id || null,
      });
      const savedPayment = await manager.getRepository(Payment).save(payment);
      await manager.getRepository(PaymentItem).save(selectedItems.map((item) => manager.getRepository(PaymentItem).create({
        paymentId: savedPayment.id,
        orderItemId: item!.id,
        amount: allocations.get(item!.id) || 0,
      })));

      const allPaid = paidItemIds.size + selectedItems.length === order.items.length;
      const allServed = order.items.every((item) => item.status === 'served');
      if (allPaid && allServed) await manager.getRepository(Order).update(data.orderId, { status: OrderStatus.PAID });
      return { payment: savedPayment, orderPaid: allPaid && allServed };
    });
    const full = await this.orderRepo.findOne({ where: { id: data.orderId }, relations: ['table', 'waiter'] });
    if (full && result.orderPaid) await this.notifications.orderEvent(full, OrderStatus.PAID);
    return result.payment;
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

  async getDailyReport(fromDate?: string, branchId?: number, toDate?: string, method?: string, actorRole?: string, actorId?: number) {
    if (actorRole && !['admin', 'owner'].includes(actorRole)) {
      const actor = actorId ? await this.userRepo.findOne({ where: { id: actorId } }) : null;
      branchId = actor?.branchId;
    }
    if (actorRole && !['admin', 'owner'].includes(actorRole) && !branchId) {
      throw new ForbiddenException('Payment reports require a branch assignment');
    }
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
