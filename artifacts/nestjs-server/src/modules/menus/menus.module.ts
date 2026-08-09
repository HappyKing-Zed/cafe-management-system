import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { MenusService } from './menus.service';
import { MenusController } from './menus.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, MenuItem])],
  providers: [MenusService],
  controllers: [MenusController],
  exports: [MenusService],
})
export class MenusModule {}
