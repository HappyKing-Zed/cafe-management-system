import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { RestaurantTable } from './table.entity';
import { User } from './user.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from '../common/enums/order-status.enum';
import { Payment } from './payment.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  // Service charge percentage applied on top of the items subtotal (e.g. 2 = 2%)
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  serviceChargePct: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  customerName: string;

  @Column({ default: 1 })
  guestCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => RestaurantTable, { nullable: true })
  @JoinColumn({ name: 'tableId' })
  table: RestaurantTable;

  @Column({ nullable: true })
  tableId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'waiterId' })
  waiter: User;

  @Column({ nullable: true })
  waiterId: number;

  @Column({ nullable: true })
  branchId: number;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (p) => p.order)
  payments: Payment[];
}
