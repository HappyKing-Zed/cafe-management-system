import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Restaurant } from './restaurant.entity';
import { User } from './user.entity';
import { MainStoreReceiptLine } from './main-store-receipt-line.entity';

@Entity('main_store_receipts')
export class MainStoreReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  restaurantId: number;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column()
  receivedById: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'receivedById' })
  receivedBy: User;

  @OneToMany(() => MainStoreReceiptLine, (line) => line.receipt, { cascade: true })
  lines: MainStoreReceiptLine[];

  @CreateDateColumn()
  createdAt: Date;
}