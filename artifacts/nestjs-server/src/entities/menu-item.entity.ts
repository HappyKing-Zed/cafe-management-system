import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { MenuCategory } from './menu-category.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ nullable: true })
  preparationTime: number; // minutes

  @ManyToOne(() => MenuCategory, (cat) => cat.items, { nullable: false })
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;

  @Column()
  categoryId: number;
}
