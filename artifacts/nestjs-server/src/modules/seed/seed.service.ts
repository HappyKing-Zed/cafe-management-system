import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Restaurant } from '../../entities/restaurant.entity';
import { Branch } from '../../entities/branch.entity';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { RestaurantTable } from '../../entities/table.entity';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Supplier } from '../../entities/supplier.entity';
import { Role } from '../../common/enums/roles.enum';
import { TableStatus } from '../../common/enums/table-status.enum';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Restaurant) private restaurantRepo: Repository<Restaurant>,
    @InjectRepository(Branch) private branchRepo: Repository<Branch>,
    @InjectRepository(MenuCategory) private catRepo: Repository<MenuCategory>,
    @InjectRepository(MenuItem) private menuRepo: Repository<MenuItem>,
    @InjectRepository(RestaurantTable) private tableRepo: Repository<RestaurantTable>,
    @InjectRepository(InventoryItem) private inventoryRepo: Repository<InventoryItem>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    private dataSource: DataSource,
  ) {}

  private async migrateLegacyBranding() {
    const migratedUsers = await this.migrateLegacyUserEmails();

    const legacyRestaurants = await this.restaurantRepo
      .createQueryBuilder('restaurant')
      .where(
        `LOWER(TRIM(restaurant.name)) IN (:...legacyNames)
          OR LOWER(TRIM(restaurant.email)) IN (:...legacyEmails)`,
        {
          legacyNames: [
            'jima aba jifar',
            'jima aba jifar restaurant',
            'abajiraf',
            'abajiraf restaurant',
          ],
          legacyEmails: [
            'info@habesha.com',
            'info@abajiraf.com',
          ],
        },
      )
      .getMany();
    for (const restaurant of legacyRestaurants) {
      restaurant.name = 'CARAVAN Lounge';
      restaurant.email = 'info@caravanlounge.com';
      await this.restaurantRepo.save(restaurant);
    }

    const legacySuppliers = await this.supplierRepo
      .createQueryBuilder('supplier')
      .where(
        `LOWER(TRIM(supplier.name)) IN (:...legacyNames)
          OR LOWER(TRIM(supplier.email)) IN (:...legacyEmails)`,
        {
          legacyNames: [
            'habesha meat suppliers',
            'abajiraf meat suppliers',
            'abajifar meat suppliers',
          ],
          legacyEmails: [
            'habesha.meat@gmail.com',
            'abajiraf.meat@gmail.com',
            'abajifar.meat@gmail.com',
          ],
        },
      )
      .getMany();
    for (const supplier of legacySuppliers) {
      supplier.name = 'Jima Meat Suppliers';
      supplier.email = 'jima.meat@gmail.com';
      await this.supplierRepo.save(supplier);
    }

    return {
      users: migratedUsers.migrated,
      consolidatedUsers: migratedUsers.consolidated,
      aliasedUsers: migratedUsers.aliased,
      restaurants: legacyRestaurants.length,
      suppliers: legacySuppliers.length,
    };
  }

  /**
   * Keeps the agreed operational accounts available in both development and
   * production. This is deliberately idempotent: existing accounts are updated
   * in place rather than duplicated, and their requested password stays valid.
   */
  async ensureRequiredAccounts() {
    const migrated = await this.migrateLegacyBranding();
    if (migrated.users || migrated.restaurants || migrated.suppliers) {
      console.log(
        `✓ Updated legacy branding in ${migrated.users} users (${migrated.consolidatedUsers} consolidated, ${migrated.aliasedUsers} safely aliased), ${migrated.restaurants} restaurants, and ${migrated.suppliers} suppliers`,
      );
    }

    let restaurant = await this.restaurantRepo.findOne({ where: { name: 'CARAVAN Lounge' } });
    if (!restaurant) {
      restaurant = await this.restaurantRepo.findOne({ order: { id: 'ASC' } });
    }
    if (!restaurant) {
      restaurant = await this.restaurantRepo.save(this.restaurantRepo.create({
        name: 'CARAVAN Lounge',
        address: 'Jimma, Ethiopia',
        phone: '+251 911 000000',
        email: 'info@caravanlounge.com',
      }));
    }

    const ensureBranch = async (name: string, address: string) => {
      let branch = await this.branchRepo.findOne({ where: { restaurantId: restaurant!.id, name } });
      if (!branch) {
        branch = await this.branchRepo.save(this.branchRepo.create({
          restaurantId: restaurant!.id,
          name,
          address,
          phone: '+251 911 000000',
        }));
      }
      return branch;
    };

    const [awetu, agaro] = await Promise.all([
      ensureBranch('Awetu Branch', 'Awetu, Jimma, Ethiopia'),
      ensureBranch('Agaro Branch', 'Agaro, Jimma, Ethiopia'),
    ]);
    const password = await bcrypt.hash(REQUIRED_ACCOUNT_PASSWORD, 10);
    const accounts: Array<{
      name: string;
      email: string;
      role: Role;
      branchId?: number;
      enforcePassword?: boolean;
    }> = [
      { name: 'Abebe Kebede', email: 'admin1@gmail.com', role: Role.ADMIN },
      { name: 'Selamawit Tesfaye', email: 'waiter1_awetu_branch@gmail.com', role: Role.WAITER, branchId: awetu.id },
      { name: 'Mikiya Alemu', email: 'waiter2_awetu_branch@gmail.com', role: Role.WAITER, branchId: awetu.id },
      { name: 'Hiwot Tadesse', email: 'waiter1_agaro_branch@gmail.com', role: Role.WAITER, branchId: agaro.id },
      { name: 'Biruk Mekonnen', email: 'waiter2_agaro_branch@gmail.com', role: Role.WAITER, branchId: agaro.id },
      { name: 'Meseret Girma', email: 'coordinator_awetu_branch@gmail.com', role: Role.COORDINATOR, branchId: awetu.id },
      { name: 'Dawit Worku', email: 'coordinator_agaro_branch@gmail.com', role: Role.COORDINATOR, branchId: agaro.id },
      { name: 'Mulugeta Bekele', email: 'chef_awetu_branch@gmail.com', role: Role.CHEF, branchId: awetu.id },
      { name: 'Genet Haile', email: 'chef_agaro_branch@gmail.com', role: Role.CHEF, branchId: agaro.id },
      { name: 'Getachew Ayele', email: 'manager_awetu_branch@gmail.com', role: Role.MANAGER, branchId: awetu.id },
      { name: 'Tigist Assefa', email: 'manager_agaro_branch@gmail.com', role: Role.MANAGER, branchId: agaro.id },
      {
        name: 'Selamawit Kebede',
        email: 'storekeeper@gmail.com',
        role: Role.STOREKEEPER,
        enforcePassword: true,
      },
      { name: 'Tadesse Wolde', email: 'owner@gmail.com', role: Role.OWNER },
    ];

    await Promise.all(accounts.map(async account => {
      const existing = await this.userRepo.findOne({ where: { email: account.email } });
      if (existing) {
        if (account.enforcePassword) {
          existing.password = password;
          existing.name = account.name;
          existing.role = account.role;
          existing.branchId = account.branchId ?? null;
          existing.restaurantId = restaurant!.id;
          existing.isActive = true;
          return this.userRepo.save(existing);
        }
        return existing;
      }
      const { enforcePassword: _enforcePassword, ...userAccount } = account;
      return this.userRepo.save(this.userRepo.create({
        ...userAccount,
        password,
        isActive: true,
        restaurantId: restaurant!.id,
        branchId: account.branchId ?? null,
      }));
    }));
    return { restaurant, branches: { awetu, agaro }, count: accounts.length };
  }

  async seed() {
    const existingAdmin = await this.userRepo.findOne({ where: { email: 'admin@gmail.com' } });
    if (existingAdmin) {
      const accounts = await this.ensureRequiredAccounts();
      return { message: 'Already seeded; required accounts ensured', status: 'skipped', accounts: accounts.count };
    }

    // ─── Restaurant ───────────────────────────────────────────────
    const restaurant = await this.restaurantRepo.save(this.restaurantRepo.create({
      name: 'CARAVAN Lounge',
      address: 'Bole Road, Addis Abeba, Ethiopia',
      phone: '+251 11 661 2345',
      email: 'info@caravanlounge.com',
    }));

    // ─── Branches ─────────────────────────────────────────────────
    const branch1 = await this.branchRepo.save(this.branchRepo.create({
      restaurantId: restaurant.id,
      name: 'Bole Branch',
      address: 'Bole Road, Addis Abeba',
      phone: '+251 11 661 2345',
    }));
    const branch2 = await this.branchRepo.save(this.branchRepo.create({
      restaurantId: restaurant.id,
      name: 'Piassa Branch',
      address: 'Piassa, Addis Abeba',
      phone: '+251 11 551 7890',
    }));

    // ─── Users ────────────────────────────────────────────────────
    const hash = async (p: string) => bcrypt.hash(p, 10);

    await this.userRepo.save([
      this.userRepo.create({ name: 'Abebe Girma', email: 'admin@gmail.com', password: await hash('admin123'), role: Role.ADMIN, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Tigist Haile', email: 'owner@gmail.com', password: await hash('owner123'), role: Role.OWNER, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Dawit Bekele', email: 'manager@gmail.com', password: await hash('manager123'), role: Role.MANAGER, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Selam Tesfaye', email: 'coordinator@gmail.com', password: await hash('coord123'), role: Role.COORDINATOR, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Yonas Alemu', email: 'waiter1@gmail.com', password: await hash('waiter123'), role: Role.WAITER, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Meron Tadesse', email: 'waiter2@gmail.com', password: await hash('waiter123'), role: Role.WAITER, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Hiwot Lemma', email: 'chef@gmail.com', password: await hash('chef123'), role: Role.CHEF, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Biruk Mengistu', email: 'cashier@gmail.com', password: await hash('cashier123'), role: Role.CASHIER, restaurantId: restaurant.id, branchId: branch1.id }),
      this.userRepo.create({ name: 'Selamawit Kebede', email: 'storekeeper@gmail.com', password: await hash('store123'), role: Role.STOREKEEPER, restaurantId: restaurant.id, branchId: branch1.id }),
    ]);

    // ─── Menu Categories ──────────────────────────────────────────
    const cats = await this.catRepo.save([
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Ethiopian Traditional', description: 'Authentic Ethiopian dishes', sortOrder: 1 }),
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Vegetarian / Fasting', description: 'Vegan & fasting friendly dishes', sortOrder: 2 }),
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Grills & Tibs', description: 'Grilled meats and stir-fries', sortOrder: 3 }),
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Stews & Soups', description: 'Hearty Ethiopian stews', sortOrder: 4 }),
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Breakfast', description: 'Ethiopian breakfast specialties', sortOrder: 5 }),
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Beverages', description: 'Traditional and modern drinks', sortOrder: 6 }),
      this.catRepo.create({ restaurantId: restaurant.id, name: 'Desserts', description: 'Sweet treats', sortOrder: 7 }),
    ]);

    const [traditional, vegetarian, grills, stews, breakfast, beverages, desserts] = cats;

    // ─── Menu Items ───────────────────────────────────────────────
    await this.menuRepo.save([
      // Traditional
      this.menuRepo.create({ categoryId: traditional.id, name: 'Doro Wat', description: 'Spicy chicken stew in berbere sauce served with injera', price: 320, preparationTime: 25 }),
      this.menuRepo.create({ categoryId: traditional.id, name: 'Kitfo', description: 'Ethiopian beef tartare with mitmita and ayibe', price: 380, preparationTime: 15 }),
      this.menuRepo.create({ categoryId: traditional.id, name: 'Beyaynet (Combo)', description: 'Assorted fasting and non-fasting dishes on injera', price: 290, preparationTime: 20 }),
      this.menuRepo.create({ categoryId: traditional.id, name: 'Tibs Firfir', description: 'Injera stir-fried with tibs and berbere', price: 260, preparationTime: 18 }),
      // Vegetarian
      this.menuRepo.create({ categoryId: vegetarian.id, name: 'Shiro Wat', description: 'Chickpea flour stew with berbere, served with injera', price: 180, preparationTime: 15 }),
      this.menuRepo.create({ categoryId: vegetarian.id, name: 'Misir Wat', description: 'Spiced red lentil stew on injera', price: 160, preparationTime: 15 }),
      this.menuRepo.create({ categoryId: vegetarian.id, name: 'Gomen', description: 'Braised Ethiopian collard greens with ginger and garlic', price: 140, preparationTime: 12 }),
      this.menuRepo.create({ categoryId: vegetarian.id, name: 'Atkilt Alicha', description: 'Mild vegetable stew with potatoes, carrots, and cabbage', price: 150, preparationTime: 15 }),
      this.menuRepo.create({ categoryId: vegetarian.id, name: 'Fasting Beyaynet', description: '8-dish vegan platter on injera', price: 250, preparationTime: 20 }),
      // Grills
      this.menuRepo.create({ categoryId: grills.id, name: 'Tibs (Beef)', description: 'Pan-fried beef with onions, tomatoes, and jalapeño', price: 350, preparationTime: 20 }),
      this.menuRepo.create({ categoryId: grills.id, name: 'Tibs (Lamb)', description: 'Pan-fried lamb with Ethiopian spices', price: 370, preparationTime: 20 }),
      this.menuRepo.create({ categoryId: grills.id, name: 'Tere Siga', description: 'Ethiopian-style raw beef with awaze sauce', price: 420, preparationTime: 10 }),
      this.menuRepo.create({ categoryId: grills.id, name: 'Mixed Grill Platter', description: 'Beef, lamb, and chicken with injera and salad', price: 480, preparationTime: 30 }),
      // Stews
      this.menuRepo.create({ categoryId: stews.id, name: 'Ye-Beg Alicha', description: 'Mild lamb stew with turmeric and onions', price: 340, preparationTime: 25 }),
      this.menuRepo.create({ categoryId: stews.id, name: 'Key Wat', description: 'Beef stew in rich berbere sauce', price: 300, preparationTime: 25 }),
      this.menuRepo.create({ categoryId: stews.id, name: 'Asa Tibs', description: 'Spiced tilapia fish stir-fry', price: 290, preparationTime: 20 }),
      // Breakfast
      this.menuRepo.create({ categoryId: breakfast.id, name: 'Ful Medames', description: 'Fava bean stew with bread', price: 120, preparationTime: 10 }),
      this.menuRepo.create({ categoryId: breakfast.id, name: 'Chechebsa (Firfir)', description: 'Kitfo-style torn injera with niter kibbeh', price: 130, preparationTime: 12 }),
      this.menuRepo.create({ categoryId: breakfast.id, name: 'Enqulal Tibs', description: 'Ethiopian scrambled eggs with onions and tomatoes', price: 110, preparationTime: 10 }),
      // Beverages
      this.menuRepo.create({ categoryId: beverages.id, name: 'Ethiopian Coffee (Buna)', description: 'Traditional Ethiopian coffee ceremony coffee', price: 80, preparationTime: 5 }),
      this.menuRepo.create({ categoryId: beverages.id, name: 'Tej', description: 'Ethiopian honey wine (mead)', price: 120, preparationTime: 2 }),
      this.menuRepo.create({ categoryId: beverages.id, name: 'Tella', description: 'Traditional Ethiopian barley beer', price: 90, preparationTime: 2 }),
      this.menuRepo.create({ categoryId: beverages.id, name: 'Avocado Juice', description: 'Fresh avocado juice with sugar', price: 100, preparationTime: 5 }),
      this.menuRepo.create({ categoryId: beverages.id, name: 'Mango Juice', description: 'Fresh mango juice', price: 90, preparationTime: 5 }),
      // Desserts
      this.menuRepo.create({ categoryId: desserts.id, name: 'Dabo Kolo', description: 'Crunchy Ethiopian snack biscuits', price: 60, preparationTime: 3 }),
      this.menuRepo.create({ categoryId: desserts.id, name: 'Sambusa', description: 'Crispy pastry filled with spiced lentils', price: 70, preparationTime: 8 }),
    ]);

    // ─── Tables ───────────────────────────────────────────────────
    const tableSections = ['Indoor', 'Outdoor', 'VIP'];
    for (let i = 1; i <= 15; i++) {
      const section = i <= 6 ? 'Indoor' : i <= 12 ? 'Outdoor' : 'VIP';
      await this.tableRepo.save(this.tableRepo.create({
        branchId: branch1.id,
        number: `T${i.toString().padStart(2, '0')}`,
        capacity: i <= 6 ? 4 : i <= 12 ? 6 : 8,
        section,
        status: i === 2 || i === 5 ? TableStatus.OCCUPIED : TableStatus.AVAILABLE,
      }));
    }
    for (let i = 1; i <= 8; i++) {
      await this.tableRepo.save(this.tableRepo.create({
        branchId: branch2.id,
        number: `T${i.toString().padStart(2, '0')}`,
        capacity: i <= 4 ? 4 : 6,
        section: i <= 4 ? 'Indoor' : 'Outdoor',
        status: TableStatus.AVAILABLE,
      }));
    }

    // ─── Inventory Items ──────────────────────────────────────────
    await this.inventoryRepo.save([
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Teff Flour', unit: 'kg', currentStock: 50, minStock: 10, unitCost: 45, category: 'Grains' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Injera', unit: 'pieces', currentStock: 200, minStock: 50, unitCost: 5, category: 'Bread' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Berbere Spice', unit: 'kg', currentStock: 15, minStock: 5, unitCost: 120, category: 'Spices' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Niter Kibbeh', unit: 'kg', currentStock: 8, minStock: 3, unitCost: 200, category: 'Fats' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Chicken (Whole)', unit: 'kg', currentStock: 30, minStock: 10, unitCost: 180, category: 'Meat' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Beef', unit: 'kg', currentStock: 40, minStock: 15, unitCost: 320, category: 'Meat' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Lamb', unit: 'kg', currentStock: 20, minStock: 8, unitCost: 380, category: 'Meat' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Red Lentils', unit: 'kg', currentStock: 25, minStock: 10, unitCost: 65, category: 'Legumes' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Chickpea Flour', unit: 'kg', currentStock: 12, minStock: 5, unitCost: 80, category: 'Legumes' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Onions', unit: 'kg', currentStock: 30, minStock: 10, unitCost: 25, category: 'Vegetables' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Garlic', unit: 'kg', currentStock: 5, minStock: 2, unitCost: 120, category: 'Vegetables' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Tomatoes', unit: 'kg', currentStock: 20, minStock: 8, unitCost: 40, category: 'Vegetables' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Ethiopian Coffee Beans', unit: 'kg', currentStock: 10, minStock: 3, unitCost: 350, category: 'Beverages' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Honey (Tej)', unit: 'liters', currentStock: 20, minStock: 5, unitCost: 280, category: 'Beverages' }),
      this.inventoryRepo.create({ restaurantId: restaurant.id, name: 'Avocado', unit: 'kg', currentStock: 15, minStock: 5, unitCost: 85, category: 'Fruits' }),
    ]);

    // ─── Suppliers ────────────────────────────────────────────────
    await this.supplierRepo.save([
      this.supplierRepo.create({ restaurantId: restaurant.id, name: 'Addis Teff Cooperative', contactPerson: 'Mulugeta Worku', email: 'addisteff@gmail.com', phone: '+251 911 223344', address: 'Debre Birhan, Ethiopia', rating: 5 }),
      this.supplierRepo.create({ restaurantId: restaurant.id, name: 'Jima Meat Suppliers', contactPerson: 'Tesfaye Girma', email: 'jima.meat@gmail.com', phone: '+251 912 556677', address: 'Mercato, Addis Abeba', rating: 4 }),
      this.supplierRepo.create({ restaurantId: restaurant.id, name: 'Yirgacheffe Coffee PLC', contactPerson: 'Desta Wolde', email: 'yirgacheffe@coffee.et', phone: '+251 913 889900', address: 'Yirgacheffe, SNNPR', rating: 5 }),
      this.supplierRepo.create({ restaurantId: restaurant.id, name: 'Merkato Spice Market', contactPerson: 'Azeb Assefa', email: 'merkato.spice@gmail.com', phone: '+251 914 112233', address: 'Merkato, Addis Abeba', rating: 4 }),
      this.supplierRepo.create({ restaurantId: restaurant.id, name: 'Fresh Produce Ethiopia', contactPerson: 'Hana Solomon', email: 'freshproduce@et.com', phone: '+251 915 445566', address: 'Kality, Addis Abeba', rating: 3 }),
    ]);

    const accounts = await this.ensureRequiredAccounts();
    return {
      message: 'Database seeded successfully with Ethiopian data',
      status: 'success',
      data: { restaurant: restaurant.name, branches: 2, users: 9, requiredAccounts: accounts.count, menuCategories: 7, menuItems: 26, tables: 23, inventoryItems: 15, suppliers: 5 },
    };
  }

  private async moveUserReferences(
    manager: EntityManager,
    duplicateUserId: number,
    canonicalUserId: number,
  ) {
    const userMetadata = manager.connection.getMetadata(User);

    for (const entityMetadata of manager.connection.entityMetadatas) {
      const userRelations = entityMetadata.relations.filter(
        relation =>
          relation.isOwning &&
          relation.inverseEntityMetadata === userMetadata &&
          relation.joinColumns.length === 1,
      );

      for (const relation of userRelations) {
        const joinColumn = relation.joinColumns[0];
        const idColumn = entityMetadata.columns.find(
          column => column.databaseName === joinColumn.databaseName,
        );
        if (!idColumn) {
          throw new Error(
            `Cannot migrate duplicate user reference ${entityMetadata.tableName}.${joinColumn.databaseName}`,
          );
        }

        await manager
          .createQueryBuilder()
          .update(entityMetadata.target)
          .set({ [idColumn.propertyName]: canonicalUserId })
          .where(`${manager.connection.driver.escape(joinColumn.databaseName)} = :duplicateUserId`, {
            duplicateUserId,
          })
          .execute();
      }
    }
  }

  private hasMatchingStaffIdentity(legacyUser: User, gmailUser: User) {
    return (
      legacyUser.name.trim().toLocaleLowerCase() === gmailUser.name.trim().toLocaleLowerCase() &&
      legacyUser.role === gmailUser.role &&
      legacyUser.isActive === gmailUser.isActive &&
      legacyUser.restaurantId === gmailUser.restaurantId &&
      legacyUser.branchId === gmailUser.branchId &&
      (legacyUser.phone ?? null) === (gmailUser.phone ?? null)
    );
  }

  private async findAvailableGmailAddress(
    userRepo: Repository<User>,
    localPart: string,
    userId: number,
  ) {
    const base = `${localPart}+legacy-${userId}`;
    let suffix = 0;

    while (true) {
      const email = `${base}${suffix ? `-${suffix}` : ''}@gmail.com`;
      const existing = await userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.email) = :email', { email })
        .getOne();
      if (!existing || existing.id === userId) return email;
      suffix += 1;
    }
  }

  private async migrateLegacyUserEmails() {
    return this.dataSource.transaction(async manager => {
      const userRepo = manager.getRepository(User);
      const legacyUsers = await userRepo
        .createQueryBuilder('user')
        .where('LOWER(user.email) LIKE :domain', { domain: '%@habesha.com' })
        .orderBy('user.id', 'ASC')
        .getMany();

      let consolidated = 0;
      let aliased = 0;

      for (const user of legacyUsers) {
        const localPart = user.email.slice(0, user.email.lastIndexOf('@')).trim().toLowerCase();
        let nextEmail = `${localPart}@gmail.com`;
        const conflict = await userRepo
          .createQueryBuilder('user')
          .addSelect('user.password')
          .where('LOWER(user.email) = :email', { email: nextEmail })
          .andWhere('user.id != :userId', { userId: user.id })
          .getOne();

        const isGeneratedDuplicate = Boolean(
          conflict &&
          REQUIRED_ACCOUNT_EMAILS.has(nextEmail) &&
          conflict.createdAt > user.createdAt &&
          this.hasMatchingStaffIdentity(user, conflict) &&
          await bcrypt.compare(REQUIRED_ACCOUNT_PASSWORD, conflict.password),
        );

        // A later bootstrap account is disposable only when every identity and
        // assignment field matches. The pre-existing legacy user is authoritative,
        // so their password and permissions survive the email rename.
        if (conflict && isGeneratedDuplicate) {
          await this.moveUserReferences(manager, conflict.id, user.id);
          await userRepo.delete(conflict.id);
          consolidated += 1;
        } else if (conflict) {
          nextEmail = await this.findAvailableGmailAddress(userRepo, localPart, user.id);
          aliased += 1;
        }

        user.email = nextEmail;
        await userRepo.save(user);
      }

      return { migrated: legacyUsers.length, consolidated, aliased };
    });
  }
}

const REQUIRED_ACCOUNT_PASSWORD = '123456';

const REQUIRED_ACCOUNT_EMAILS = new Set([
  'admin1@gmail.com',
  'waiter1_awetu_branch@gmail.com',
  'waiter2_awetu_branch@gmail.com',
  'waiter1_agaro_branch@gmail.com',
  'waiter2_agaro_branch@gmail.com',
  'coordinator_awetu_branch@gmail.com',
  'coordinator_agaro_branch@gmail.com',
  'chef_awetu_branch@gmail.com',
  'chef_agaro_branch@gmail.com',
  'manager_awetu_branch@gmail.com',
  'manager_agaro_branch@gmail.com',
  'owner@gmail.com',
]);
