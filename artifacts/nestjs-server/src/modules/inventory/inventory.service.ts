import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { Supplier } from '../../entities/supplier.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { StockAdjustment, AdjustmentType } from '../../entities/stock-adjustment.entity';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem) private itemRepo: Repository<InventoryItem>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(StockAdjustment) private adjRepo: Repository<StockAdjustment>,
  ) {}

  // Items
  findAllItems(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.itemRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOneItem(id: number) {
    const i = await this.itemRepo.findOne({ where: { id } });
    if (!i) throw new NotFoundException('Item not found');
    return i;
  }

  createItem(data: Partial<InventoryItem>) { return this.itemRepo.save(this.itemRepo.create(data)); }

  async updateItem(id: number, data: Partial<InventoryItem>) {
    const i = await this.findOneItem(id);
    Object.assign(i, data);
    return this.itemRepo.save(i);
  }

  async removeItem(id: number) {
    const i = await this.findOneItem(id);
    return this.itemRepo.remove(i);
  }

  getLowStockItems(restaurantId?: number) {
    return this.itemRepo.createQueryBuilder('item')
      .where('item.currentStock <= item.minStock')
      .andWhere(restaurantId ? 'item.restaurantId = :rid' : '1=1', { rid: restaurantId })
      .getMany();
  }

  // Suppliers
  findAllSuppliers(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.supplierRepo.find({ where, order: { name: 'ASC' } });
  }

  async findOneSupplier(id: number) {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Supplier not found');
    return s;
  }

  createSupplier(data: Partial<Supplier>) { return this.supplierRepo.save(this.supplierRepo.create(data)); }

  async updateSupplier(id: number, data: Partial<Supplier>) {
    const s = await this.findOneSupplier(id);
    Object.assign(s, data);
    return this.supplierRepo.save(s);
  }

  // Purchase Orders
  findAllPOs(supplierId?: number) {
    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    return this.poRepo.find({ where, relations: ['supplier', 'items', 'items.inventoryItem', 'requestedBy', 'approvedBy'], order: { createdAt: 'DESC' } });
  }

  async findOnePO(id: number) {
    const po = await this.poRepo.findOne({ where: { id }, relations: ['supplier', 'items', 'items.inventoryItem', 'requestedBy'] });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  createPO(data: Partial<PurchaseOrder>) {
    const po = this.poRepo.create(data);
    return this.poRepo.save(po);
  }

  async updatePOStatus(id: number, status: string, approvedById?: number) {
    const po = await this.findOnePO(id);
    po.status = status as any;
    if (approvedById) po.approvedById = approvedById;
    // If received, update inventory stock
    if (status === 'received') {
      for (const item of po.items) {
        await this.itemRepo.increment({ id: item.inventoryItemId }, 'currentStock', item.quantity);
      }
    }
    return this.poRepo.save(po);
  }

  // Stock Adjustments
  async createAdjustment(data: { inventoryItemId: number; type: AdjustmentType; quantity: number; reason?: string; createdById?: number }) {
    const item = await this.findOneItem(data.inventoryItemId);
    const adj = this.adjRepo.create(data);
    await this.adjRepo.save(adj);

    const delta = data.type === AdjustmentType.ADDITION ? data.quantity : -Math.abs(data.quantity);
    await this.itemRepo.increment({ id: data.inventoryItemId }, 'currentStock', delta);

    return adj;
  }

  findAllAdjustments(inventoryItemId?: number) {
    const where: any = {};
    if (inventoryItemId) where.inventoryItemId = inventoryItemId;
    return this.adjRepo.find({ where, relations: ['inventoryItem', 'createdBy'], order: { createdAt: 'DESC' } });
  }
}
