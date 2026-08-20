import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuItem } from '../../entities/menu-item.entity';
import { assignDefined } from '../../common/utils/assign-defined';

const CATEGORY_FIELDS: readonly (keyof MenuCategory)[] = ['name', 'description', 'sortOrder', 'isActive', 'restaurantId'];
const ITEM_FIELDS: readonly (keyof MenuItem)[] = ['name', 'description', 'price', 'imageUrl', 'isAvailable', 'preparationTime', 'categoryId'];

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(MenuCategory) private catRepo: Repository<MenuCategory>,
    @InjectRepository(MenuItem) private itemRepo: Repository<MenuItem>,
  ) {}

  // Categories
  findAllCategories(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.catRepo.find({ where, relations: ['items'], order: { sortOrder: 'ASC' } });
  }

  async findOneCategory(id: number) {
    const c = await this.catRepo.findOne({ where: { id }, relations: ['items'] });
    if (!c) throw new NotFoundException('Category not found');
    return c;
  }

  createCategory(data: Partial<MenuCategory>) {
    return this.catRepo.save(assignDefined(this.catRepo.create(), data, CATEGORY_FIELDS));
  }

  async updateCategory(id: number, data: Partial<MenuCategory>) {
    const c = await this.findOneCategory(id);
    assignDefined(c, data, CATEGORY_FIELDS);
    return this.catRepo.save(c);
  }

  async removeCategory(id: number) {
    const c = await this.findOneCategory(id);
    return this.catRepo.remove(c);
  }

  // Items
  findAllItems(categoryId?: number, restaurantId?: number) {
    const where: any = {};
    if (categoryId) where.categoryId = categoryId;
    return this.itemRepo.find({ where, relations: ['category'], order: { name: 'ASC' } });
  }

  async findOneItem(id: number) {
    const i = await this.itemRepo.findOne({ where: { id }, relations: ['category'] });
    if (!i) throw new NotFoundException('Menu item not found');
    return i;
  }

  createItem(data: Partial<MenuItem>) {
    return this.itemRepo.save(assignDefined(this.itemRepo.create(), data, ITEM_FIELDS));
  }

  async updateItem(id: number, data: Partial<MenuItem>) {
    const i = await this.findOneItem(id);
    assignDefined(i, data, ITEM_FIELDS);
    return this.itemRepo.save(i);
  }

  async removeItem(id: number) {
    const i = await this.findOneItem(id);
    return this.itemRepo.remove(i);
  }
}
