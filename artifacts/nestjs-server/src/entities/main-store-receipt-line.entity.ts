import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { MainStoreReceipt } from './main-store-receipt.entity';
import { MainStoreItem } from './main-store-item.entity';

@Entity('main_store_receipt_lines')
export class MainStoreReceiptLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  receiptId: number;

  @ManyToOne(() => MainStoreReceipt, (receipt) => receipt.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiptId' })
  receipt: MainStoreReceipt;

  @Column()
  mainStoreItemId: number;

  @ManyToOne(() => MainStoreItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'mainStoreItemId' })
  item: MainStoreItem;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  unitCost: number;
}