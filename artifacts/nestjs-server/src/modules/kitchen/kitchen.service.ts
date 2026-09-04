import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { OrderItemStatus } from '../../common/enums/order-item-status.enum';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order) private repo: Repository<Order>,
    private ordersService: OrdersService,
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
        '(items.status IN (:...activeItems) OR o.status IN (:...active) OR (o.status IN (:...done) AND o.updatedAt >= :todayStart))',
        {
          activeItems: [
            OrderItemStatus.PENDING,
            OrderItemStatus.CONFIRMED,
            OrderItemStatus.ACCEPTED,
            OrderItemStatus.PREPARING,
          ],
          active: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING],
          done: [OrderStatus.READY, OrderStatus.SERVED],
          todayStart,
        },
      )
      .orderBy('o.createdAt', 'ASC');
    if (branchId) qb.andWhere('o.branchId = :branchId', { branchId });
    return qb.getMany();
  }

  private async setItemStatus(
    id: number,
    from: OrderItemStatus,
    status: OrderItemStatus,
    user: { id: number; role: string },
    branchId?: number,
  ) {
    const order = await this.repo.findOne({ where: { id }, relations: ['items'] });
    if (!order) throw new NotFoundException('Order not found');
    if (branchId && order.branchId && order.branchId !== branchId) {
      throw new ForbiddenException('This order belongs to another branch');
    }
    const eligible = order.items.filter((item) => item.status === from);
    if (!eligible.length) throw new BadRequestException(`No "${from}" items are available for this action`);
    let updated: Order = order;
    for (const item of eligible) {
      updated = await this.ordersService.updateItemStatus(id, item.id, status, user);
    }
    return updated;
  }

  confirmOrder(id: number, user: { id: number; role: string }, branchId?: number) {
    return this.setItemStatus(id, OrderItemStatus.PENDING, OrderItemStatus.CONFIRMED, user, branchId);
  }

  acceptOrder(id: number, user: { id: number; role: string }, branchId?: number) {
    return this.setItemStatus(id, OrderItemStatus.CONFIRMED, OrderItemStatus.ACCEPTED, user, branchId);
  }

  startPreparing(id: number, user: { id: number; role: string }, branchId?: number) {
    return this.setItemStatus(id, OrderItemStatus.ACCEPTED, OrderItemStatus.PREPARING, user, branchId);
  }

  markReady(id: number, user: { id: number; role: string }, branchId?: number) {
    return this.setItemStatus(id, OrderItemStatus.PREPARING, OrderItemStatus.READY, user, branchId);
  }
}
