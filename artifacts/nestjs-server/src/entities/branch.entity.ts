import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { RestaurantTable } from './table.entity';
import { User } from './user.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Restaurant, (r) => r.branches, { nullable: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  restaurantId: number;

  @OneToMany(() => RestaurantTable, (t) => t.branch)
  tables: RestaurantTable[];

  @OneToMany(() => User, (u) => u.branch)
  staff: User[];
}
