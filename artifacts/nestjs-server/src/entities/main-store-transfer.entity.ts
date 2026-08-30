import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { Branch } from './branch.entity';
import { User } from './user.entity';
import { MainStoreTransferLine } from './main-store-transfer-line.entity';

export enum MainStoreTransferStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  TRANSFERRED = 'transferred',
  REJECTED = 'rejected',
}

@Entity('main_store_transfers')
export class MainStoreTransfer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  restaurantId: number;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  destinationBranchId: number;

  @ManyToOne(() => Branch, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'destinationBranchId' })
  destinationBranch: Branch;

  @Column({ type: 'enum', enum: MainStoreTransferStatus, default: MainStoreTransferStatus.PENDING })
  status: MainStoreTransferStatus;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column()
  requestedById: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requestedById' })
  requestedBy: User;

  @Column({ nullable: true })
  approvedById: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  rejectedById: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rejectedById' })
  rejectedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date;

  @Column({ nullable: true })
  transferredById: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transferredById' })
  transferredBy: User;

  @Column({ type: 'timestamp', nullable: true })
  transferredAt: Date;

  @OneToMany(() => MainStoreTransferLine, (line) => line.transfer, { cascade: true })
  lines: MainStoreTransferLine[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
