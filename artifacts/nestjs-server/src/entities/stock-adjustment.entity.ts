import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { User } from './user.entity';

export enum AdjustmentType {
  ADDITION = 'addition',
  DEDUCTION = 'deduction',
  WASTE = 'waste',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment',
}

@Entity('stock_adjustments')
export class StockAdjustment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: AdjustmentType })
  type: AdjustmentType;

  @Column('decimal', { precision: 10, scale: 3 })
  quantity: number;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => InventoryItem, { nullable: false })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column()
  inventoryItemId: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  createdById: number;
}
