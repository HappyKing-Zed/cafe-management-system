import { Branch } from '../entities/branch.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { ItemRequest } from '../entities/item-request.entity';
import { MenuCategory } from '../entities/menu-category.entity';
import { MenuItem } from '../entities/menu-item.entity';
import { Notification } from '../entities/notification.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';
import { Payment } from '../entities/payment.entity';
import { PurchaseOrderItem } from '../entities/purchase-order-item.entity';
import { PurchaseOrder } from '../entities/purchase-order.entity';
import { Restaurant } from '../entities/restaurant.entity';
import { ServiceSubmission } from '../entities/service-submission.entity';
import { Shift } from '../entities/shift.entity';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { Supplier } from '../entities/supplier.entity';
import { RestaurantTable } from '../entities/table.entity';
import { User } from '../entities/user.entity';
import { MainStoreItem } from '../entities/main-store-item.entity';
import { MainStoreReceipt } from '../entities/main-store-receipt.entity';
import { MainStoreReceiptLine } from '../entities/main-store-receipt-line.entity';
import { MainStoreTransfer } from '../entities/main-store-transfer.entity';
import { MainStoreTransferLine } from '../entities/main-store-transfer-line.entity';
import { MainStoreMovement } from '../entities/main-store-movement.entity';

export const DATABASE_ENTITIES = [
  User,
  Restaurant,
  Branch,
  MenuCategory,
  MenuItem,
  RestaurantTable,
  Order,
  OrderItem,
  Payment,
  Shift,
  InventoryItem,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  StockAdjustment,
  ItemRequest,
  Notification,
  ServiceSubmission,
  MainStoreItem,
  MainStoreReceipt,
  MainStoreReceiptLine,
  MainStoreTransfer,
  MainStoreTransferLine,
  MainStoreMovement,
];
