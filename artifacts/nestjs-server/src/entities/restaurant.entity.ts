import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Branch } from './branch.entity';
import { MenuCategory } from './menu-category.entity';
import { InventoryItem } from './inventory-item.entity';
import { Supplier } from './supplier.entity';

@Entity('restaurants')
export class Restaurant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Branch, (branch) => branch.restaurant)
  branches: Branch[];

  @OneToMany(() => MenuCategory, (cat) => cat.restaurant)
  menuCategories: MenuCategory[];

  @OneToMany(() => InventoryItem, (item) => item.restaurant)
  inventoryItems: InventoryItem[];

  @OneToMany(() => Supplier, (s) => s.restaurant)
  suppliers: Supplier[];
}
