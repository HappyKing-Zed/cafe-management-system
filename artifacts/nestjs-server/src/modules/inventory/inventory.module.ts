import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Supplier } from '../../entities/supplier.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { StockAdjustment } from '../../entities/stock-adjustment.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, Supplier, PurchaseOrder, PurchaseOrderItem, StockAdjustment])],
  providers: [InventoryService],
  controllers: [InventoryController],
  exports: [InventoryService],
})
export class InventoryModule {}
