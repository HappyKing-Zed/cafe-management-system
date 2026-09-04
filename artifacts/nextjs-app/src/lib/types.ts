export type Role = 'admin' | 'owner' | 'manager' | 'coordinator' | 'waiter' | 'chef' | 'cashier' | 'storekeeper';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  phone?: string;
  restaurantId?: number;
  branchId?: number;
  restaurant?: Restaurant;
  branch?: Branch;
}

export interface Restaurant {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  branches?: Branch[];
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  isActive: boolean;
  restaurantId: number;
  restaurant?: Restaurant;
}

export interface MenuCategory {
  id: number;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  restaurantId: number;
  items?: MenuItem[];
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  preparationTime?: number;
  categoryId: number;
  category?: MenuCategory;
}

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';
export interface RestaurantTable {
  id: number;
  number: string;
  capacity: number;
  status: TableStatus;
  section?: string;
  branchId: number;
  branch?: Branch;
}

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';
export type OrderItemStatus = 'pending' | 'confirmed' | 'accepted' | 'preparing' | 'ready' | 'served';
export interface OrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  notes?: string;
  menuItemId: number;
  menuItem: MenuItem;
  orderId: number;
  status?: OrderItemStatus;
}

export interface Order {
  id: number;
  orderNumber?: number;
  status: OrderStatus;
  totalAmount: number;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  guestCount: number;
  createdAt: string;
  updatedAt: string;
  tableId?: number;
  table?: RestaurantTable;
  waiterId?: number;
  waiter?: User;
  chefId?: number;
  chef?: User;
  items: OrderItem[];
  payments?: Payment[];
}

export interface Payment {
  id: number;
  amount: number;
  method: 'cash' | 'card' | 'mobile';
  changeGiven: number;
  reference?: string;
  createdAt: string;
  orderId: number;
  cashierId?: number;
}

export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  unitCost?: number;
  category?: string;
  restaurantId: number;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  rating?: number;
  restaurantId: number;
}

export interface PurchaseOrder {
  id: number;
  status: string;
  totalAmount: number;
  notes?: string;
  supplierId: number;
  supplier?: Supplier;
  items: PurchaseOrderItem[];
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  inventoryItemId: number;
  inventoryItem?: InventoryItem;
}
