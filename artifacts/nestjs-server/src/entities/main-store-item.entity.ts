import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';

@Entity('main_store_items')
@Index(['restaurantId', 'normalizedName', 'normalizedUnit'], { unique: true })
export class MainStoreItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  restaurantId: number;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  name: string;

  @Column()
  unit: string;

  @Column()
  normalizedName: string;

  @Column()
  normalizedUnit: string;

  @Column({ nullable: true })
  category: string;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  unitCost: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  minStock: number;

  @Column('decimal', { precision: 12, scale: 3, default: 0 })
  currentStock: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}