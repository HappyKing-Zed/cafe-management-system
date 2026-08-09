import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { MenuItem } from './menu-item.entity';

@Entity('menu_categories')
export class MenuCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @ManyToOne(() => Restaurant, (r) => r.menuCategories, { nullable: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  restaurantId: number;

  @OneToMany(() => MenuItem, (item) => item.category)
  items: MenuItem[];
}
