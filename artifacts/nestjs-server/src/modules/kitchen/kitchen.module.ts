import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { KitchenService } from './kitchen.service';
import { KitchenController } from './kitchen.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  providers: [KitchenService],
  controllers: [KitchenController],
})
export class KitchenModule {}
