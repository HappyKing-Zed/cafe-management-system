import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';

@Injectable()
export class KitchenService {
  constructor(@InjectRepository(Order) private repo: Repository<Order>) {}

  getBoard(branchId?: number) {
    return this.repo.find({
      where: {
        status: In([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING]),
        ...(branchId ? { branchId } : {}),
      },
      relations: ['table', 'items', 'items.menuItem'],
      order: { createdAt: 'ASC' },
    });
  }

  private async setStatus(id: number, status: OrderStatus, branchId?: number) {
    const order = await this.repo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (branchId && order.branchId && order.branchId !== branchId) {
      throw new ForbiddenException('This order belongs to another branch');
    }
    return this.repo.update(id, { status });
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
