import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';
import { Branch } from './branch.entity';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  openingCash: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  closingCash: number;

  @Column({ nullable: true })
  closedAt: Date;

  @Column({ default: true })
  isOpen: boolean;

  @CreateDateColumn()
  openedAt: Date;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'cashierId' })
  cashier: User;

  @Column()
  cashierId: number;

  @ManyToOne(() => Branch, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  branchId: number;
}
