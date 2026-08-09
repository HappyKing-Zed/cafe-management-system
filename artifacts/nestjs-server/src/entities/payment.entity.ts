import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Order } from './order.entity';
import { User } from './user.entity';

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE = 'mobile',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  changeGiven: number;

  @Column({ nullable: true })
  reference: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Order, (o) => o.payments)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'cashierId' })
  cashier: User;

  @Column({ nullable: true })
  cashierId: number;
}
