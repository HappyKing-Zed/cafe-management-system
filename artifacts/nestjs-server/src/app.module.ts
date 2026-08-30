import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { BranchesModule } from './modules/branches/branches.module';
import { MenusModule } from './modules/menus/menus.module';
import { TablesModule } from './modules/tables/tables.module';
import { OrdersModule } from './modules/orders/orders.module';
import { KitchenModule } from './modules/kitchen/kitchen.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SeedModule } from './modules/seed/seed.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SummaryModule } from './modules/summary/summary.module';
import { MainStoreModule } from './modules/main-store/main-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    RestaurantsModule,
    BranchesModule,
    MenusModule,
    TablesModule,
    OrdersModule,
    KitchenModule,
    PaymentsModule,
    SummaryModule,
    InventoryModule,
    MainStoreModule,
    SeedModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
