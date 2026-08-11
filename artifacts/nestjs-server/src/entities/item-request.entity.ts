import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { User } from './user.entity';

export enum ItemRequestStatus {
  PENDING = 'pending',     // requested by any staff member
  APPROVED = 'approved',   // manager/owner approved
  REJECTED = 'rejected',
  ISSUED = 'issued',       // storekeeper released the stock (stock out)
  RECEIVED = 'received',   // requester confirmed they got the items
}

@Entity('item_requests')
export class ItemRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: ItemRequestStatus, default: ItemRequestStatus.PENDING })
  status: ItemRequestStatus;

  @Column('decimal', { precision: 10, scale: 3 })
  quantity: number;

  @Column({ nullable: true })
  notes: string;

  // Who the items are for (filled in by the coordinator) and why
  @Column({ nullable: true })
  requesterName: string;

  @Column({ nullable: true })
  reason: string;

  // Snapshot of the item's unit price at request time (total = quantity × unitCost)
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitCost: number;

  @ManyToOne(() => InventoryItem, { nullable: false, eager: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column()
  inventoryItemId: number;

  @ManyToOne(() => User, { nullable: false, eager: true })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User;

  @Column()
  requestedById: number;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User;

  @Column({ nullable: true })
  approvedById: number;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'issuedById' })
  issuedBy: User;

  @Column({ nullable: true })
  issuedById: number;

  @Column({ nullable: true })
  branchId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
