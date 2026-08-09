import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  unit: string;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  currentStock: number;

  @Column('decimal', { precision: 10, scale: 3, default: 0 })
  minStock: number;

  @Column('decimal', { precision: 10, scale: 3, nullable: true })
  reorderPoint: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitCost: number;

  @Column({ nullable: true })
  category: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Restaurant, (r) => r.inventoryItems, { nullable: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  restaurantId: number;
}
