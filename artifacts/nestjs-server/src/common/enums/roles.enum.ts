export enum Role {
  ADMIN = 'admin',
  OWNER = 'owner',
  MANAGER = 'manager',
  COORDINATOR = 'coordinator',
  WAITER = 'waiter',
  CHEF = 'chef',
  CHEF_MAIN_KITCHEN = 'chef_main_kitchen',
  BAR_MAN = 'bar_man',
  JUICE_MAKER = 'juice_maker',
  COFFEE_LADY = 'coffee_lady',
  CASHIER = 'cashier',
  STOREKEEPER = 'storekeeper',
}

export const KITCHEN_WORKER_ROLES: readonly Role[] = [
  Role.CHEF,
  Role.CHEF_MAIN_KITCHEN,
  Role.BAR_MAN,
  Role.JUICE_MAKER,
  Role.COFFEE_LADY,
];

export function isKitchenWorkerRole(role?: string): boolean {
  return KITCHEN_WORKER_ROLES.includes(role as Role);
}
