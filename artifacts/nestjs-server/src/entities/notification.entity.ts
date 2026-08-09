import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  message: string;

  /** Role this notification targets (e.g. 'chef'); null when targeting a specific user */
  @Column({ nullable: true })
  targetRole: string;

  /** Specific user this notification targets (e.g. the order's waiter) */
  @Column({ nullable: true })
  targetUserId: number;

  @Column({ nullable: true })
  branchId: number;

  @Column({ nullable: true })
  orderId: number;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
