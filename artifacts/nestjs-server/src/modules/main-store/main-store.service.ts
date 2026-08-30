import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { MainStoreItem } from '../../entities/main-store-item.entity';
import { MainStoreReceipt } from '../../entities/main-store-receipt.entity';
import { MainStoreReceiptLine } from '../../entities/main-store-receipt-line.entity';
import { MainStoreTransferLine } from '../../entities/main-store-transfer-line.entity';
import { MainStoreTransfer, MainStoreTransferStatus } from '../../entities/main-store-transfer.entity';
import { Restaurant } from '../../entities/restaurant.entity';
import { User } from '../../entities/user.entity';

type AuthUser = User & { restaurantId?: number; branchId?: number };

@Injectable()
export class MainStoreService {
  constructor(
    @InjectRepository(MainStoreItem) private readonly itemRepo: Repository<MainStoreItem>,
    @InjectRepository(MainStoreTransfer) private readonly transferRepo: Repository<MainStoreTransfer>,
    private readonly dataSource: DataSource,
  ) {}

  private restaurantId(user: AuthUser): number {
    const id = Number(user?.restaurantId);
    if (!Number.isInteger(id) || id <= 0) throw new ForbiddenException('Your account is not assigned to a restaurant');
    return id;
  }

  private assertMainStoreAccess(user: AuthUser) {
    if (user.role === 'owner') return;
    if (user.role === 'storekeeper' && !user.branchId) return;
    throw new ForbiddenException('Main Store is restricted to the owner and Main Store storekeeper');
  }

  private positive(value: unknown, label: string): number {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new BadRequestException(`${label} must be a positive finite number`);
    return number;
  }

  private optionalNonNegative(value: unknown, label: string): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`${label} must be a non-negative finite number`);
    return number;
  }

  private identity(value: unknown, label: string): { display: string; normalized: string } {
    if (typeof value !== 'string') throw new BadRequestException(`${label} is required`);
    const display = value.trim().replace(/\s+/g, ' ');
    if (!display) throw new BadRequestException(`${label} is required`);
    if (display.length > 255) throw new BadRequestException(`${label} is too long`);
    return { display, normalized: display.toLocaleLowerCase('en-US') };
  }

  findItems(user: AuthUser) {
    this.assertMainStoreAccess(user);
    return this.itemRepo.find({
      where: { restaurantId: this.restaurantId(user) },
      order: { name: 'ASC', unit: 'ASC' },
    });
  }

  findDestinations(user: AuthUser) {
    this.assertMainStoreAccess(user);
    return this.dataSource.getRepository(Branch).find({
      where: { restaurantId: this.restaurantId(user) },
      order: { name: 'ASC' },
    });
  }

  async createReceipt(data: any, user: AuthUser) {
    this.assertMainStoreAccess(user);
    const restaurantId = this.restaurantId(user);
    if (!Array.isArray(data?.lines) || !data.lines.length) {
      throw new BadRequestException('Receipt needs at least one line');
    }
    const lines = data.lines.map((line: any, index: number) => {
      const name = this.identity(line?.name, `Line ${index + 1} name`);
      const unit = this.identity(line?.unit, `Line ${index + 1} unit`);
      const category = line?.category == null ? undefined : this.identity(line.category, `Line ${index + 1} category`).display;
      return {
        name: name.display,
        normalizedName: name.normalized,
        unit: unit.display,
        normalizedUnit: unit.normalized,
        category,
        quantity: this.positive(line?.quantity, `Line ${index + 1} quantity`),
        unitCost: this.optionalNonNegative(line?.unitCost, `Line ${index + 1} unit cost`),
        minStock: this.optionalNonNegative(line?.minStock, `Line ${index + 1} minimum stock`),
      };
    });
    const identities = lines.map((line: any) => `${line.normalizedName}\0${line.normalizedUnit}`);
    if (new Set(identities).size !== identities.length) {
      throw new BadRequestException('Receipt contains duplicate name and unit lines');
    }

    return this.dataSource.transaction(async (em) => {
      // Serializing receipts per restaurant also closes the race between lookup and
      // insert while preserving the database unique constraint as a final safeguard.
      const restaurant = await em.getRepository(Restaurant).findOne({
        where: { id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!restaurant) throw new ForbiddenException('Restaurant not found');

      const receipt = await em.save(em.create(MainStoreReceipt, {
        restaurantId,
        receivedById: user.id,
        note: typeof data.note === 'string' ? data.note.trim() || null : null,
      }));
      const savedLines: MainStoreReceiptLine[] = [];
      for (const line of lines) {
        let item = await em.getRepository(MainStoreItem).findOne({
          where: {
            restaurantId,
            normalizedName: line.normalizedName,
            normalizedUnit: line.normalizedUnit,
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (!item) {
          item = await em.save(em.create(MainStoreItem, {
            restaurantId,
            name: line.name,
            unit: line.unit,
            normalizedName: line.normalizedName,
            normalizedUnit: line.normalizedUnit,
            category: line.category,
            unitCost: line.unitCost,
            minStock: line.minStock ?? 0,
            currentStock: 0,
          }));
        } else {
          if (line.category !== undefined) item.category = line.category;
          if (line.unitCost !== undefined) item.unitCost = line.unitCost;
          if (line.minStock !== undefined) item.minStock = line.minStock;
          await em.save(item);
        }
        await em.increment(MainStoreItem, { id: item.id }, 'currentStock', line.quantity);
        savedLines.push(await em.save(em.create(MainStoreReceiptLine, {
          receiptId: receipt.id,
          mainStoreItemId: item.id,
          quantity: line.quantity,
          unitCost: line.unitCost ?? item.unitCost ?? null,
        })));
      }
      receipt.lines = savedLines;
      return receipt;
    });
  }

  findTransfers(user: AuthUser) {
    const restaurantId = this.restaurantId(user);
    const where: any = { restaurantId };
    if (user.role === 'manager') {
      if (!user.branchId) throw new ForbiddenException('Manager is not assigned to a branch');
      where.destinationBranchId = user.branchId;
    } else {
      this.assertMainStoreAccess(user);
    }
    return this.transferRepo.find({
      where,
      relations: ['destinationBranch', 'lines', 'requestedBy', 'approvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async createTransfer(data: any, user: AuthUser) {
    this.assertMainStoreAccess(user);
    const restaurantId = this.restaurantId(user);
    const destinationBranchId = Number(data?.destinationBranchId);
    if (!Number.isInteger(destinationBranchId) || destinationBranchId <= 0) {
      throw new BadRequestException('A valid destination branch is required');
    }
    if (!Array.isArray(data?.lines) || !data.lines.length) {
      throw new BadRequestException('Transfer needs at least one line');
    }
    const lines = data.lines.map((line: any, index: number) => {
      const mainStoreItemId = Number(line?.mainStoreItemId);
      if (!Number.isInteger(mainStoreItemId) || mainStoreItemId <= 0) {
        throw new BadRequestException(`Line ${index + 1} has an invalid main store item`);
      }
      return {
        mainStoreItemId,
        quantity: this.positive(line?.quantity, `Line ${index + 1} quantity`),
      };
    });
    const ids = lines.map((line: any) => line.mainStoreItemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Transfer contains duplicate items');

    return this.dataSource.transaction(async (em) => {
      const branch = await em.findOne(Branch, { where: { id: destinationBranchId, restaurantId } });
      if (!branch) throw new BadRequestException('Destination branch does not belong to your restaurant');
      const items = await em.getRepository(MainStoreItem).find({
        where: { id: In([...ids].sort((a, b) => a - b)), restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (items.length !== ids.length) throw new BadRequestException('One or more main store items do not exist');
      const byId = new Map(items.map((item) => [item.id, item]));
      for (const line of lines) {
        const item = byId.get(line.mainStoreItemId)!;
        if (Number(item.currentStock) < line.quantity) {
          throw new BadRequestException(`Not enough stock: only ${Number(item.currentStock)} ${item.unit} of ${item.name} available`);
        }
      }
      for (const line of lines) {
        await em.decrement(MainStoreItem, { id: line.mainStoreItemId }, 'currentStock', line.quantity);
      }
      const transfer = await em.save(em.create(MainStoreTransfer, {
        restaurantId,
        destinationBranchId,
        status: MainStoreTransferStatus.PENDING,
        requestedById: user.id,
        note: typeof data.note === 'string' ? data.note.trim() || null : null,
        lines: lines.map((line: any) => {
          const item = byId.get(line.mainStoreItemId)!;
          return em.create(MainStoreTransferLine, {
            mainStoreItemId: item.id,
            quantity: line.quantity,
            name: item.name,
            unit: item.unit,
            category: item.category,
            unitCost: item.unitCost,
            minStock: item.minStock,
          });
        }),
      }));
      return em.findOne(MainStoreTransfer, {
        where: { id: transfer.id },
        relations: ['destinationBranch', 'lines', 'requestedBy'],
      });
    });
  }

  approveTransfer(id: number, user: AuthUser) {
    return this.decideTransfer(id, user, MainStoreTransferStatus.APPROVED);
  }

  rejectTransfer(id: number, user: AuthUser) {
    return this.decideTransfer(id, user, MainStoreTransferStatus.REJECTED);
  }

  private async decideTransfer(id: number, user: AuthUser, decision: MainStoreTransferStatus) {
    const restaurantId = this.restaurantId(user);
    return this.dataSource.transaction(async (em) => {
      const transfer = await em.getRepository(MainStoreTransfer).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!transfer) throw new NotFoundException('Main store transfer not found');
      if (transfer.restaurantId !== restaurantId) throw new ForbiddenException('Transfer belongs to another restaurant');
      if (user.role !== 'manager' || !user.branchId || transfer.destinationBranchId !== user.branchId) {
        throw new ForbiddenException('Only the destination branch manager may decide this transfer');
      }
      if (transfer.status === decision) {
        return em.findOne(MainStoreTransfer, { where: { id }, relations: ['destinationBranch', 'lines', 'requestedBy', 'approvedBy'] });
      }
      if (transfer.status !== MainStoreTransferStatus.PENDING) {
        throw new BadRequestException(`Transfer is already '${transfer.status}'`);
      }
      const lines = await em.getRepository(MainStoreTransferLine).find({
        where: { transferId: id },
        order: { mainStoreItemId: 'ASC' },
      });
      const now = new Date();
      if (decision === MainStoreTransferStatus.REJECTED) {
        const itemIds = lines.map((line) => line.mainStoreItemId);
        if (itemIds.length) {
          await em.getRepository(MainStoreItem).find({
            where: { id: In(itemIds) },
            lock: { mode: 'pessimistic_write' },
          });
        }
        for (const line of lines) {
          await em.increment(MainStoreItem, { id: line.mainStoreItemId, restaurantId }, 'currentStock', Number(line.quantity));
        }
        transfer.status = decision;
        transfer.rejectedAt = now;
      } else {
        // Lock the branch to serialize approvals that could concurrently create
        // the same previously absent destination inventory identity.
        const branch = await em.getRepository(Branch).findOne({
          where: { id: transfer.destinationBranchId, restaurantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!branch) throw new BadRequestException('Destination branch no longer exists');
        for (const line of lines) {
          let destinationItem = await em.getRepository(InventoryItem)
            .createQueryBuilder('item')
            .setLock('pessimistic_write')
            .where('item."restaurantId" = :restaurantId', { restaurantId })
            .andWhere('item."branchId" = :branchId', { branchId: transfer.destinationBranchId })
            .andWhere('LOWER(item.name) = LOWER(:name)', { name: line.name })
            .andWhere('LOWER(item.unit) = LOWER(:unit)', { unit: line.unit })
            .orderBy('item.id', 'ASC')
            .getOne();
          if (!destinationItem) {
            destinationItem = await em.save(em.create(InventoryItem, {
              restaurantId,
              branchId: transfer.destinationBranchId,
              name: line.name,
              unit: line.unit,
              category: line.category,
              unitCost: line.unitCost,
              minStock: Number(line.minStock) || 0,
              currentStock: 0,
            }));
          }
          await em.increment(InventoryItem, { id: destinationItem.id }, 'currentStock', Number(line.quantity));
        }
        transfer.status = decision;
        transfer.approvedById = user.id;
        transfer.approvedAt = now;
      }
      await em.save(transfer);
      return em.findOne(MainStoreTransfer, {
        where: { id },
        relations: ['destinationBranch', 'lines', 'requestedBy', 'approvedBy'],
      });
    });
  }
}