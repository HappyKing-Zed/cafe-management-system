import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MainStoreItem } from '../../entities/main-store-item.entity';
import { MainStoreReceiptLine } from '../../entities/main-store-receipt-line.entity';
import { MainStoreReceipt } from '../../entities/main-store-receipt.entity';
import { MainStoreTransferLine } from '../../entities/main-store-transfer-line.entity';
import { MainStoreTransfer } from '../../entities/main-store-transfer.entity';
import { MainStoreMovement } from '../../entities/main-store-movement.entity';
import { MainStoreController } from './main-store.controller';
import { MainStoreService } from './main-store.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([
    MainStoreItem,
    MainStoreReceipt,
    MainStoreReceiptLine,
    MainStoreTransfer,
    MainStoreTransferLine,
    MainStoreMovement,
  ]), NotificationsModule],
  controllers: [MainStoreController],
  providers: [MainStoreService],
})
export class MainStoreModule {}
