import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { MainStoreTransfer } from './main-store-transfer.entity';
import { MainStoreItem } from './main-store-item.entity';

@Entity('main_store_transfer_lines')
export class MainStoreTransferLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transferId: number;

  @ManyToOne(() => MainStoreTransfer, (transfer) => transfer.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transferId' })
  transfer: MainStoreTransfer;

  @Column()
  mainStoreItemId: number;

  @ManyToOne(() => MainStoreItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mainStoreItemId' })
  item: MainStoreItem;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column()
  name: string;

  @Column()
  unit: string;

  @Column({ nullable: true })
  category: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  unitCost: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  minStock: number;
}