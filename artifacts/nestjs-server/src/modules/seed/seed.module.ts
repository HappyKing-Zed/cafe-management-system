import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Restaurant } from '../../entities/restaurant.entity';
import { Branch } from '../../entities/branch.entity';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { RestaurantTable } from '../../entities/table.entity';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Supplier } from '../../entities/supplier.entity';
import { SeedService } from './seed.service';
import { SeedController } from './seed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Restaurant, Branch, MenuCategory, MenuItem, RestaurantTable, InventoryItem, Supplier])],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
