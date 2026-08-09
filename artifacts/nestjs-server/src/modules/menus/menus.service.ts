import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuItem } from '../../entities/menu-item.entity';

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

  createCategory(data: Partial<MenuCategory>) { return this.catRepo.save(this.catRepo.create(data)); }

  async updateCategory(id: number, data: Partial<MenuCategory>) {
    const c = await this.findOneCategory(id);
    Object.assign(c, data);
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

  createItem(data: Partial<MenuItem>) { return this.itemRepo.save(this.itemRepo.create(data)); }

  async updateItem(id: number, data: Partial<MenuItem>) {
    const i = await this.findOneItem(id);
    Object.assign(i, data);
    return this.itemRepo.save(i);
  }

  async removeItem(id: number) {
    const i = await this.findOneItem(id);
    return this.itemRepo.remove(i);
  }
}
