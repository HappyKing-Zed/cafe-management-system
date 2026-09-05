import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Payment } from './payment.entity';
import { OrderItem } from './order-item.entity';

@Entity('payment_items')
@Index(['orderItemId'], { unique: true })
export class PaymentItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @ManyToOne(() => Payment, (payment) => payment.paymentItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment: Payment;

  @Column()
  paymentId: number;

  @ManyToOne(() => OrderItem, (item) => item.paymentItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column()
  orderItemId: number;
}