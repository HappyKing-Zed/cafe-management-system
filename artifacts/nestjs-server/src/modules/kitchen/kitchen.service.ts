import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderItemStatus } from '../../common/enums/order-item-status.enum';
import { isKitchenWorkerRole, Role } from '../../common/enums/roles.enum';
import { Branch } from '../../entities/branch.entity';
import { User } from '../../entities/user.entity';

@Injectable()
export class KitchenService {
  constructor(
    @InjectRepository(Order) private repo: Repository<Order>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    private ordersService: OrdersService,
  ) {}

  private async resolveBoardActor(user: { id: number; role: string }): Promise<User> {
    const actor = await this.userRepo.findOne({ where: { id: user.id } });
    if (!actor || !actor.isActive) throw new ForbiddenException('Your account is not active');
    if (actor.role === Role.COORDINATOR || isKitchenWorkerRole(actor.role)) {
      if (!actor.branchId || !actor.restaurantId) {
        throw new ForbiddenException('Kitchen board access requires a branch and restaurant assignment');
      }
      const branch = await this.branchRepo.findOne({ where: { id: actor.branchId } });
      if (!branch || branch.restaurantId !== actor.restaurantId) {
        throw new ForbiddenException('Your branch does not belong to your restaurant');
      }
    }
    return actor;
  }

  async getBoard(user: { id: number; role: string }) {
    const actor = await this.resolveBoardActor(user);
    const isKitchenActor = actor.role === Role.COORDINATOR || isKitchenWorkerRole(actor.role);
    const qb = this.repo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.table', 'table')
      .leftJoinAndSelect('o.waiter', 'waiter')
      .leftJoinAndSelect('o.chef', 'chef')
      .innerJoinAndSelect('o.items', 'items', 'items.status IN (:...activeItems)', {
        activeItems: [
          OrderItemStatus.PENDING,
          OrderItemStatus.CONFIRMED,
          OrderItemStatus.ACCEPTED,
          OrderItemStatus.PREPARING,
          OrderItemStatus.READY,
        ],
      })
      .leftJoinAndSelect('items.menuItem', 'menuItem')
      .leftJoinAndSelect('items.assignedKitchenWorker', 'assignedKitchenWorker')
      .orderBy('o.createdAt', 'ASC');
    if (actor.restaurantId) {
      qb.innerJoin(Branch, 'orderBranch', 'orderBranch.id = o.branchId')
        .andWhere('orderBranch.restaurantId = :restaurantId', { restaurantId: actor.restaurantId });
    }
    if (isKitchenActor) qb.andWhere('o.branchId = :branchId', { branchId: actor.branchId });
    if (isKitchenWorkerRole(actor.role)) {
      qb.andWhere('items.assignedKitchenWorkerId = :workerId', { workerId: actor.id });
    }
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
    const actor = await this.resolveBoardActor(user);
    if (!actor.branchId || actor.branchId !== order.branchId) {
      throw new ForbiddenException('This order belongs to another branch');
    }
    const orderBranch = await this.branchRepo.findOne({ where: { id: order.branchId } });
    if (!orderBranch || !actor.restaurantId || orderBranch.restaurantId !== actor.restaurantId) {
      throw new ForbiddenException('This order belongs to another restaurant');
    }
    const eligible = order.items.filter((item) =>
      item.status === from &&
      (actor.role === Role.COORDINATOR || (isKitchenWorkerRole(actor.role) && item.assignedKitchenWorkerId === actor.id)),
    );
    if (!eligible.length) throw new BadRequestException(`No "${from}" items are available for this action`);
    let updated: Order = order;
    for (const item of eligible) {
      updated = await this.ordersService.updateItemStatus(id, item.id, status, actor);
    }
    return updated;
  }

  confirmOrder(id: number, user: { id: number; role: string }, branchId?: number) {
    throw new BadRequestException('Use item assignments to confirm pending kitchen items');
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
