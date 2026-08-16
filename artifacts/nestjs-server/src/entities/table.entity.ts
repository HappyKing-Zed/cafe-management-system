import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Branch } from './branch.entity';
import { TableStatus } from '../common/enums/table-status.enum';

@Entity('tables')
export class RestaurantTable {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: string;

  @Column({ default: 4 })
  capacity: number;

  @Column({ type: 'enum', enum: TableStatus, default: TableStatus.AVAILABLE })
  status: TableStatus;

  @Column({ nullable: true })
  section: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Branch, (b) => b.tables, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branchId' })
  branch: Branch;

  @Column()
  branchId: number;
}
