import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from './menu-item.entity';

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
}
