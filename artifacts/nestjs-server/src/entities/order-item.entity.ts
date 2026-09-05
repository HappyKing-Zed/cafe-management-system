import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from './menu-item.entity';
import { User } from './user.entity';
import { OrderItemStatus } from '../common/enums/order-item-status.enum';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ nullable: true })
  notes: string;

  // Nullable only for rows created before item-level lifecycle tracking existed.
  // New application writes always set this explicitly.
  @Column({ type: 'enum', enum: OrderItemStatus, nullable: true })
  status: OrderItemStatus;

  @ManyToOne(() => Order, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: number;

  @ManyToOne(() => MenuItem, { eager: true })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;

  @Column()
  menuItemId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assignedKitchenWorkerId' })
  assignedKitchenWorker: User;

  @Column({ nullable: true })
  assignedKitchenWorkerId: number;
}
