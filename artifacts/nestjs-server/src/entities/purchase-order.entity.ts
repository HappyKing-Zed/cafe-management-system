import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, CreateDateColumn } from 'typeorm';
import { Supplier } from './supplier.entity';
import { User } from './user.entity';
import { PurchaseOrderItem } from './purchase-order-item.entity';

export enum POStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  APPROVED = 'approved',
  ORDERED = 'ordered',
  RECEIVED = 'received',
  REJECTED = 'rejected',
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: POStatus, default: POStatus.DRAFT })
  status: POStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  expectedDelivery: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Supplier, { nullable: false })
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @Column()
  supplierId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User;

  @Column({ nullable: true })
  requestedById: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User;

  @Column({ nullable: true })
  approvedById: number;

  @Column({ nullable: true })
  branchId: number;

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchaseOrder, { cascade: true, eager: true })
  items: PurchaseOrderItem[];
}
