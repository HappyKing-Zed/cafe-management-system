import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class KitchenService {
  constructor(@InjectRepository(Order) private repo: Repository<Order>) {}

  getBoard() {
    return this.repo.find({
      where: { status: In([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING]) },
      relations: ['table', 'items', 'items.menuItem'],
      order: { createdAt: 'ASC' },
    });
  }

  acceptOrder(id: number) {
    return this.repo.update(id, { status: OrderStatus.CONFIRMED });
  }

  startPreparing(id: number) {
    return this.repo.update(id, { status: OrderStatus.PREPARING });
  }

  markReady(id: number) {
    return this.repo.update(id, { status: OrderStatus.READY });
  }
}
