import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Role } from '../common/enums/roles.enum';
import { Restaurant } from './restaurant.entity';
import { Branch } from './branch.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.WAITER })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Restaurant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column({ nullable: true })
  restaurantId: number;

  @ManyToOne(() => Branch, (b) => b.staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column({ nullable: true })
  branchId: number;
}
