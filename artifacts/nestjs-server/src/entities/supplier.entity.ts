import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Restaurant } from './restaurant.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  rating: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Restaurant, (r) => r.suppliers, { nullable: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column()
  restaurantId: number;
}
