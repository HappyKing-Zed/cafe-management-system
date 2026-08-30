import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { MainStoreItem } from './main-store-item.entity';
import { MainStoreReceipt } from './main-store-receipt.entity';
import { MainStoreTransfer } from './main-store-transfer.entity';
import { User } from './user.entity';

export enum MainStoreMovementType {
  STOCK_IN = 'stock_in',
  STOCK_OUT = 'stock_out',
}

@Entity('main_store_movements')
export class MainStoreMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: MainStoreMovementType })
  type: MainStoreMovementType;

  @Column()
  restaurantId: number;

  @Column()
  mainStoreItemId: number;

  @ManyToOne(() => MainStoreItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mainStoreItemId' })
  item: MainStoreItem;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { precision: 12, scale: 3 })
  balanceAfter: number;

  @Column({ nullable: true })
  receiptId: number;

  @ManyToOne(() => MainStoreReceipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receiptId' })
  receipt: MainStoreReceipt;

  @Column({ nullable: true })
  transferId: number;

  @ManyToOne(() => MainStoreTransfer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transferId' })
  transfer: MainStoreTransfer;

  @Column()
  actorId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'actorId' })
  actor: User;

  @CreateDateColumn()
  createdAt: Date;
}