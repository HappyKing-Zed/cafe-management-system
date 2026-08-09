import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 10, scale: 3 })
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number;

  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchaseOrderId' })
  purchaseOrder: PurchaseOrder;

  @Column()
  purchaseOrderId: number;

  @ManyToOne(() => InventoryItem, { eager: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @Column()
  inventoryItemId: number;
}
