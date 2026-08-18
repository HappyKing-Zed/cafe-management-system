import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum SubmissionStatus {
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
}

/** A waiter's service report handed over to the cashier (a waiter may send several per day; each covers only orders not yet reported). */
@Entity('service_submissions')
export class ServiceSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  // Service day being reported, e.g. '2026-08-17'
  @Column({ type: 'date' })
  serviceDate: string;

  @Column({ default: 0 })
  ordersCount: number;

  @Column({ default: 0 })
  itemsCount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalRevenue: number;

  // Per-order / per-item breakdown snapshot at submission time
  @Column({ type: 'jsonb', nullable: true })
  detail: any;

  // Earlier versions of this report (kept when the waiter resubmits):
  // [{ submittedAt, ordersCount, itemsCount, totalRevenue, detail }]
  @Column({ type: 'jsonb', nullable: true })
  revisions: any;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.SUBMITTED })
  status: SubmissionStatus;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'waiterId' })
  waiter: User;

  @Column()
  waiterId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cashierId' })
  cashier: User;

  @Column({ nullable: true })
  cashierId: number;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ nullable: true })
  branchId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
