import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { Branch } from '../../entities/branch.entity';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Branch]), NotificationsModule, OrdersModule],
  providers: [KitchenService],
  controllers: [KitchenController],
})
export class KitchenModule {}
