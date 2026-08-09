import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), NotificationsModule],
  providers: [KitchenService],
  controllers: [KitchenController],
})
export class KitchenModule {}
