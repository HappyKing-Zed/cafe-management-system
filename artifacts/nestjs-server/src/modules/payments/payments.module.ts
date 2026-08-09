import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../../entities/payment.entity';
import { Shift } from '../../entities/shift.entity';
import { Order } from '../../entities/order.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Shift, Order]), NotificationsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
