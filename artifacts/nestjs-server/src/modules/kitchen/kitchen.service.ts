import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order) private repo: Repository<Order>,
    private notifications: NotificationsService,
  ) {}

  getBoard(branchId?: number) {
    // Active orders always; completed (ready/served) only from today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.table', 'table')
      .leftJoinAndSelect('o.waiter', 'waiter')
      .leftJoinAndSelect('o.chef', 'chef')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('items.menuItem', 'menuItem')
      .where(
        '(o.status IN (:...active) OR (o.status IN (:...done) AND o.updatedAt >= :todayStart))',
        {
          active: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING],
          done: [OrderStatus.READY, OrderStatus.SERVED],
          todayStart,
        },
      )
      .orderBy('o.createdAt', 'ASC');
    if (branchId) qb.andWhere('o.branchId = :branchId', { branchId });
    return qb.getMany();
  }

  private async setStatus(id: number, status: OrderStatus, branchId?: number) {
    const order = await this.repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (branchId && order.branchId && order.branchId !== branchId) {
      throw new ForbiddenException('This order belongs to another branch');
    }
    if (order.status !== status && !OrdersService.TRANSITIONS[order.status]?.includes(status)) {
      throw new BadRequestException(`Cannot move an order from "${order.status}" to "${status}"`);
    }
    await this.repo.update(id, { status });
    if (order.status !== status) {
      const full = await this.repo.findOne({ where: { id }, relations: ['table', 'waiter'] });
      if (full) await this.notifications.orderEvent(full, status);
    }
    return { affected: 1 };
  }

  acceptOrder(id: number, branchId?: number) {
    return this.setStatus(id, OrderStatus.CONFIRMED, branchId);
  }

  startPreparing(id: number, branchId?: number) {
    return this.setStatus(id, OrderStatus.PREPARING, branchId);
  }

  markReady(id: number, branchId?: number) {
    return this.setStatus(id, OrderStatus.READY, branchId);
  }
}
