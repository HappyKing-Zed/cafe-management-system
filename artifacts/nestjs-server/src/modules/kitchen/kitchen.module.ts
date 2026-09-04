import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order]), NotificationsModule, OrdersModule],
  providers: [KitchenService],
  controllers: [KitchenController],
})
export class KitchenModule {}
