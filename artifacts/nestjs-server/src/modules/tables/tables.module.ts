import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantTable } from '../../entities/table.entity';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RestaurantTable])],
  providers: [TablesService],
  controllers: [TablesController],
  exports: [TablesService],
})
export class TablesModule {}
