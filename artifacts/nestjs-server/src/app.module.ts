import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Restaurant } from './entities/restaurant.entity';
import { Branch } from './entities/branch.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { RestaurantTable } from './entities/table.entity';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Payment } from './entities/payment.entity';
import { Shift } from './entities/shift.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { Supplier } from './entities/supplier.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { StockAdjustment } from './entities/stock-adjustment.entity';
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
import { Notification } from './entities/notification.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        User, Restaurant, Branch, MenuCategory, MenuItem,
        RestaurantTable, Order, OrderItem, Payment, Shift,
        InventoryItem, Supplier, PurchaseOrder, PurchaseOrderItem, StockAdjustment, Notification,
      ],
      synchronize: true,
      ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
    }),
    AuthModule,
    UsersModule,
    RestaurantsModule,
    BranchesModule,
    MenusModule,
    TablesModule,
    OrdersModule,
    KitchenModule,
    PaymentsModule,
    InventoryModule,
    SeedModule,
    NotificationsModule,
  ],
})
export class AppModule {}
