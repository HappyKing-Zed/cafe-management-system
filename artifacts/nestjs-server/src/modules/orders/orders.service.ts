import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import { OrderItem } from '../../entities/order-item.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { RestaurantTable } from '../../entities/table.entity';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { TableStatus } from '../../common/enums/table-status.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private itemRepo: Repository<OrderItem>,
    @InjectRepository(MenuItem) private menuRepo: Repository<MenuItem>,
    @InjectRepository(RestaurantTable) private tableRepo: Repository<RestaurantTable>,
  ) {}

  findAll(status?: OrderStatus, tableId?: number) {
    const where: any = {};
    if (status) where.status = status;
    if (tableId) where.tableId = tableId;
    return this.orderRepo.find({
      where,
      relations: ['table', 'waiter', 'items', 'items.menuItem'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number) {
    const o = await this.orderRepo.findOne({
      where: { id },
      relations: ['table', 'waiter', 'items', 'items.menuItem', 'payments'],
    });
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  async create(data: { tableId?: number; waiterId?: number; notes?: string; customerName?: string; guestCount?: number; items?: Array<{ menuItemId: number; quantity: number; notes?: string }> }) {
    const order = this.orderRepo.create({
      tableId: data.tableId,
      waiterId: data.waiterId,
      notes: data.notes,
      customerName: data.customerName,
      guestCount: data.guestCount || 1,
      status: OrderStatus.PENDING,
    });

    if (data.items && data.items.length > 0) {
      let total = 0;
      const orderItems: OrderItem[] = [];
      for (const item of data.items) {
        const menuItem = await this.menuRepo.findOne({ where: { id: item.menuItemId } });
        if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
        const oi = this.itemRepo.create({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          notes: item.notes,
        });
        orderItems.push(oi);
        total += Number(menuItem.price) * item.quantity;
      }
      order.items = orderItems;
      order.totalAmount = total;
    }

    const saved = await this.orderRepo.save(order);

    // Mark table as occupied
    if (data.tableId) {
      await this.tableRepo.update(data.tableId, { status: TableStatus.OCCUPIED });
    }

    return this.findOne(saved.id);
  }

  async addItems(orderId: number, items: Array<{ menuItemId: number; quantity: number; notes?: string }>) {
    const order = await this.findOne(orderId);
    if (order.status === OrderStatus.PAID || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot modify a paid or cancelled order');
    }

    for (const item of items) {
      const menuItem = await this.menuRepo.findOne({ where: { id: item.menuItemId } });
      if (!menuItem) throw new NotFoundException(`Menu item ${item.menuItemId} not found`);
      
      const existing = order.items.find(i => i.menuItemId === item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
        await this.itemRepo.save(existing);
      } else {
        const oi = this.itemRepo.create({
          orderId,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: menuItem.price,
          notes: item.notes,
        });
        await this.itemRepo.save(oi);
      }
    }

    // Recalculate total
    const updated = await this.findOne(orderId);
    const total = updated.items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0);
    await this.orderRepo.update(orderId, { totalAmount: total });
    return this.findOne(orderId);
  }

  async updateStatus(id: number, status: OrderStatus) {
    await this.orderRepo.update(id, { status });
    const order = await this.findOne(id);

    // Free table when order is paid/cancelled
    if ((status === OrderStatus.PAID || status === OrderStatus.CANCELLED) && order.tableId) {
      await this.tableRepo.update(order.tableId, { status: TableStatus.CLEANING });
    }
    return order;
  }

  async remove(id: number) {
    const o = await this.findOne(id);
    return this.orderRepo.remove(o);
  }

  async getDashboardStats(restaurantId?: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayOrders = await this.orderRepo.createQueryBuilder('order')
      .where('order.createdAt >= :today', { today })
      .andWhere('order.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getMany();

    const totalRevenue = todayOrders
      .filter(o => o.status === OrderStatus.PAID)
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const pendingOrders = await this.orderRepo.count({ where: { status: OrderStatus.PENDING } });
    const preparingOrders = await this.orderRepo.count({ where: { status: OrderStatus.PREPARING } });

    return {
      todayOrders: todayOrders.length,
      todayRevenue: totalRevenue,
      pendingOrders,
      preparingOrders,
    };
  }
}
