import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { InventoryItem } from '../../entities/inventory-item.entity';
import { MainStoreItem } from '../../entities/main-store-item.entity';
import { MainStoreMovement, MainStoreMovementType } from '../../entities/main-store-movement.entity';
import { MainStoreReceipt } from '../../entities/main-store-receipt.entity';
import { MainStoreReceiptLine } from '../../entities/main-store-receipt-line.entity';
import { MainStoreTransferLine } from '../../entities/main-store-transfer-line.entity';
import { MainStoreTransfer, MainStoreTransferStatus } from '../../entities/main-store-transfer.entity';
import { Restaurant } from '../../entities/restaurant.entity';
import { StockAdjustment, AdjustmentType } from '../../entities/stock-adjustment.entity';
import { User } from '../../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

type AuthUser = User & { restaurantId?: number; branchId?: number };
const transferRelations = ['destinationBranch', 'lines', 'requestedBy', 'approvedBy', 'rejectedBy', 'transferredBy'];

@Injectable()
export class MainStoreService {
  constructor(
    @InjectRepository(MainStoreItem) private readonly itemRepo: Repository<MainStoreItem>,
    @InjectRepository(MainStoreTransfer) private readonly transferRepo: Repository<MainStoreTransfer>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  private restaurantId(user: AuthUser): number {
    const id = Number(user?.restaurantId);
    if (!Number.isInteger(id) || id <= 0) throw new ForbiddenException('Your account is not assigned to a restaurant');
    return id;
  }

  private assertMainStoreAccess(user: AuthUser) {
    if (user.role === 'owner' || (user.role === 'storekeeper' && !user.branchId)) return;
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

  private identity(value: unknown, label: string) {
    if (typeof value !== 'string') throw new BadRequestException(`${label} is required`);
    const display = value.trim().replace(/\s+/g, ' ');
    if (!display || display.length > 255) throw new BadRequestException(`${label} is required`);
    return { display, normalized: display.toLocaleLowerCase('en-US') };
  }

  private async notifyUsers(userIds: number[], message: string, branchId?: number) {
    for (const userId of [...new Set(userIds)]) {
      await this.notifications.notify({ userId, message, branchId });
    }
  }

  private async restaurantOwners(restaurantId: number) {
    return this.dataSource.getRepository(User).find({
      where: {
        restaurantId,
        role: 'owner' as any,
        isActive: true,
      },
    });
  }

  private async destinationManagers(restaurantId: number, branchId: number) {
    return this.dataSource.getRepository(User).find({
      where: {
        restaurantId,
        branchId,
        role: 'manager' as any,
        isActive: true,
      },
    });
  }

  private async mainStorekeepers(restaurantId: number) {
    return this.dataSource.getRepository(User).find({
      where: {
        restaurantId,
        role: 'storekeeper' as any,
        branchId: IsNull(),
        isActive: true,
      },
    });
  }

  findItems(user: AuthUser) {
    this.assertMainStoreAccess(user);
    return this.itemRepo.find({ where: { restaurantId: this.restaurantId(user) }, order: { name: 'ASC', unit: 'ASC' } });
  }

  /** Requesters may browse available central stock, but cannot alter it. */
  findRequestableItems(user: AuthUser) {
    return this.itemRepo.find({ where: { restaurantId: this.restaurantId(user) }, order: { name: 'ASC', unit: 'ASC' } });
  }

  findDestinations(user: AuthUser) {
    this.assertMainStoreAccess(user);
    return this.dataSource.getRepository(Branch).find({ where: { restaurantId: this.restaurantId(user) }, order: { name: 'ASC' } });
  }

  async createReceipt(data: any, user: AuthUser) {
    this.assertMainStoreAccess(user);
    const restaurantId = this.restaurantId(user);
    if (!Array.isArray(data?.lines) || !data.lines.length) throw new BadRequestException('Receipt needs at least one line');
    const lines = data.lines.map((line: any, i: number) => {
      const name = this.identity(line?.name, `Line ${i + 1} name`), unit = this.identity(line?.unit, `Line ${i + 1} unit`);
      return { name: name.display, normalizedName: name.normalized, unit: unit.display, normalizedUnit: unit.normalized,
        category: line?.category == null ? undefined : this.identity(line.category, `Line ${i + 1} category`).display,
        quantity: this.positive(line?.quantity, `Line ${i + 1} quantity`), unitCost: this.optionalNonNegative(line?.unitCost, `Line ${i + 1} unit cost`), minStock: this.optionalNonNegative(line?.minStock, `Line ${i + 1} minimum stock`) };
    });
    if (new Set(lines.map((l: any) => `${l.normalizedName}\0${l.normalizedUnit}`)).size !== lines.length) throw new BadRequestException('Receipt contains duplicate name and unit lines');
    return this.dataSource.transaction(async em => {
      const restaurant = await em.getRepository(Restaurant).findOne({ where: { id: restaurantId }, lock: { mode: 'pessimistic_write' } });
      if (!restaurant) throw new ForbiddenException('Restaurant not found');
      const receipt = await em.save(em.create(MainStoreReceipt, { restaurantId, receivedById: user.id, note: typeof data.note === 'string' ? data.note.trim() || null : null }));
      const savedLines: MainStoreReceiptLine[] = [];
      for (const line of lines) {
        let item = await em.getRepository(MainStoreItem).findOne({ where: { restaurantId, normalizedName: line.normalizedName, normalizedUnit: line.normalizedUnit }, lock: { mode: 'pessimistic_write' } });
        if (!item) item = await em.save(em.create(MainStoreItem, { restaurantId, name: line.name, unit: line.unit, normalizedName: line.normalizedName, normalizedUnit: line.normalizedUnit, category: line.category, unitCost: line.unitCost, minStock: line.minStock ?? 0, currentStock: 0 }));
        else { if (line.category !== undefined) item.category = line.category; if (line.unitCost !== undefined) item.unitCost = line.unitCost; if (line.minStock !== undefined) item.minStock = line.minStock; }
        const balance = Number(item.currentStock) + line.quantity;
        item.currentStock = balance; await em.save(item);
        savedLines.push(await em.save(em.create(MainStoreReceiptLine, { receiptId: receipt.id, mainStoreItemId: item.id, quantity: line.quantity, unitCost: line.unitCost ?? item.unitCost ?? null })));
        await em.save(em.create(MainStoreMovement, { type: MainStoreMovementType.STOCK_IN, restaurantId, mainStoreItemId: item.id, quantity: line.quantity, balanceAfter: balance, receiptId: receipt.id, actorId: user.id }));
      }
      receipt.lines = savedLines; return receipt;
    });
  }

  findTransfers(user: AuthUser) {
    const restaurantId = this.restaurantId(user), where: any = { restaurantId };
    if (user.role === 'manager' || (user.role === 'storekeeper' && user.branchId)) {
      if (!user.branchId) throw new ForbiddenException('Account is not assigned to a branch');
      where.destinationBranchId = user.branchId;
    } else this.assertMainStoreAccess(user);
    return this.transferRepo.find({ where, relations: transferRelations, order: { createdAt: 'DESC' } });
  }

  async createTransfer(data: any, user: AuthUser) {
    const restaurantId = this.restaurantId(user), destinationBranchId = Number(user.branchId);
    if (user.role !== 'storekeeper' || !Number.isInteger(destinationBranchId) || destinationBranchId <= 0) throw new ForbiddenException('Only a branch storekeeper may request stock');
    if (!Array.isArray(data?.lines) || !data.lines.length) throw new BadRequestException('Transfer needs at least one line');
    const lines = data.lines.map((line: any, i: number) => ({ mainStoreItemId: Number(line?.mainStoreItemId), quantity: this.positive(line?.quantity, `Line ${i + 1} quantity`) }));
    if (lines.some((l: any) => !Number.isInteger(l.mainStoreItemId) || l.mainStoreItemId <= 0)) throw new BadRequestException('Transfer has an invalid main store item');
    const ids = lines.map((l: any) => l.mainStoreItemId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Transfer contains duplicate items');
    const created = await this.dataSource.transaction(async em => {
      const branch = await em.findOne(Branch, { where: { id: destinationBranchId, restaurantId } });
      if (!branch) throw new ForbiddenException('Your branch does not belong to your restaurant');
      const items = await em.getRepository(MainStoreItem).findBy({ id: In(ids), restaurantId });
      if (items.length !== ids.length) throw new BadRequestException('One or more main store items do not exist');
      const byId = new Map(items.map(x => [x.id, x]));
      const transfer = await em.save(em.create(MainStoreTransfer, { restaurantId, destinationBranchId, status: MainStoreTransferStatus.PENDING, requestedById: user.id, note: typeof data.note === 'string' ? data.note.trim() || null : null, lines: lines.map((line: any) => { const item = byId.get(line.mainStoreItemId)!; return em.create(MainStoreTransferLine, { ...line, name: item.name, unit: item.unit, category: item.category, unitCost: item.unitCost, minStock: item.minStock }); }) }));
      return em.findOne(MainStoreTransfer, { where: { id: transfer.id }, relations: transferRelations });
    });
    const message = `Main store transfer #${created!.id} was requested — awaiting approval`;
    const [managers, owners] = await Promise.all([
      this.destinationManagers(restaurantId, destinationBranchId),
      this.restaurantOwners(restaurantId),
    ]);
    await this.notifyUsers(
      managers.map((recipient) => recipient.id),
      message,
      destinationBranchId,
    );
    await this.notifyUsers(
      owners.map((recipient) => recipient.id),
      message,
    );
    return created;
  }

  approveTransfer(id: number, user: AuthUser) { return this.decideTransfer(id, user, MainStoreTransferStatus.APPROVED); }
  rejectTransfer(id: number, user: AuthUser) { return this.decideTransfer(id, user, MainStoreTransferStatus.REJECTED); }

  private async decideTransfer(id: number, user: AuthUser, decision: MainStoreTransferStatus) {
    const restaurantId = this.restaurantId(user);
    if (user.role !== 'owner' && user.role !== 'manager') throw new ForbiddenException('Only owners and managers may decide transfers');
    const decided = await this.dataSource.transaction(async em => {
      const transfer = await em.getRepository(MainStoreTransfer).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!transfer) throw new NotFoundException('Main store transfer not found');
      if (transfer.restaurantId !== restaurantId || (user.role === 'manager' && (!user.branchId || transfer.destinationBranchId !== user.branchId))) throw new ForbiddenException('You may only decide transfers for your branch');
      if (transfer.status !== MainStoreTransferStatus.PENDING) throw new BadRequestException(`Transfer is already '${transfer.status}'`);
      transfer.status = decision;
      if (decision === MainStoreTransferStatus.APPROVED) { transfer.approvedById = user.id; transfer.approvedAt = new Date(); }
      else { transfer.rejectedById = user.id; transfer.rejectedAt = new Date(); }
      await em.save(transfer);
      return em.findOne(MainStoreTransfer, { where: { id }, relations: transferRelations });
    });
    const action = decision === MainStoreTransferStatus.APPROVED ? 'approved' : 'rejected';
    await this.notifications.notify({ userId: decided!.requestedById, message: `Main store transfer #${id} was ${action}`, branchId: decided!.destinationBranchId });
    const mainStorekeepers = await this.mainStorekeepers(restaurantId);
    for (const storekeeper of mainStorekeepers) {
      await this.notifications.notify({ userId: storekeeper.id, message: `Main store transfer #${id} was ${action}` });
    }
    return decided;
  }

  async transfer(id: number, user: AuthUser) {
    this.assertMainStoreAccess(user);
    if (user.role !== 'storekeeper' || user.branchId) throw new ForbiddenException('Only the Main Store storekeeper may fulfill transfers');
    const restaurantId = this.restaurantId(user);
    const completed = await this.dataSource.transaction(async em => {
      const transfer = await em.getRepository(MainStoreTransfer).findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!transfer) throw new NotFoundException('Main store transfer not found');
      if (transfer.restaurantId !== restaurantId) throw new ForbiddenException('Transfer belongs to another restaurant');
      if (transfer.status !== MainStoreTransferStatus.APPROVED) throw new BadRequestException(`Only approved transfers can be fulfilled`);
      const branch = await em.getRepository(Branch).findOne({ where: { id: transfer.destinationBranchId, restaurantId }, lock: { mode: 'pessimistic_write' } });
      if (!branch) throw new BadRequestException('Destination branch no longer exists');
      const lines = await em.getRepository(MainStoreTransferLine).find({ where: { transferId: id }, order: { mainStoreItemId: 'ASC' } });
      const ids = lines.map(l => l.mainStoreItemId);
      const items = await em.getRepository(MainStoreItem).find({ where: { id: In(ids), restaurantId }, lock: { mode: 'pessimistic_write' } });
      const byId = new Map(items.map(item => [item.id, item]));
      if (items.length !== lines.length) throw new BadRequestException('A requested main store item no longer exists');
      for (const line of lines) { const item = byId.get(line.mainStoreItemId)!; if (Number(item.currentStock) < Number(line.quantity)) throw new BadRequestException(`Not enough stock: only ${Number(item.currentStock)} ${item.unit} of ${item.name} available`); }
      for (const line of lines) {
        const item = byId.get(line.mainStoreItemId)!, quantity = Number(line.quantity), mainBalance = Number(item.currentStock) - quantity;
        item.currentStock = mainBalance; await em.save(item);
        let destination = await em.getRepository(InventoryItem).createQueryBuilder('item').setLock('pessimistic_write').where('item."restaurantId" = :restaurantId AND item."branchId" = :branchId', { restaurantId, branchId: branch.id }).andWhere('LOWER(item.name) = LOWER(:name) AND LOWER(item.unit) = LOWER(:unit)', { name: line.name, unit: line.unit }).orderBy('item.id', 'ASC').getOne();
        if (!destination) destination = await em.save(em.create(InventoryItem, { restaurantId, branchId: branch.id, name: line.name, unit: line.unit, category: line.category, unitCost: line.unitCost, minStock: Number(line.minStock) || 0, currentStock: 0 }));
        const branchBalance = Number(destination.currentStock) + quantity; destination.currentStock = branchBalance; await em.save(destination);
        line.mainStoreBalanceAfter = mainBalance; line.branchBalanceAfter = branchBalance; await em.save(line);
        await em.save(em.create(MainStoreMovement, { type: MainStoreMovementType.STOCK_OUT, restaurantId, mainStoreItemId: item.id, quantity, balanceAfter: mainBalance, transferId: transfer.id, actorId: user.id }));
        await em.save(em.create(StockAdjustment, { inventoryItemId: destination.id, type: AdjustmentType.ADDITION, quantity, reason: `Main store transfer #${transfer.id} (stock in)`, createdById: user.id, branchId: branch.id, mainStoreTransferId: transfer.id, balanceAfter: branchBalance }));
      }
      transfer.status = MainStoreTransferStatus.TRANSFERRED; transfer.transferredById = user.id; transfer.transferredAt = new Date(); await em.save(transfer);
      return em.findOne(MainStoreTransfer, { where: { id }, relations: transferRelations });
    });
    const transferMessage = `Main store transfer #${id} was transferred to your branch`;
    const [managers, owners] = await Promise.all([
      this.destinationManagers(restaurantId, completed!.destinationBranchId),
      this.restaurantOwners(restaurantId),
    ]);
    await this.notifyUsers(
      [completed!.requestedById, ...managers.map((recipient) => recipient.id)],
      transferMessage,
      completed!.destinationBranchId,
    );
    await this.notifyUsers(
      owners.map((recipient) => recipient.id),
      `Main store transfer #${id} was transferred`,
    );
    return completed;
  }
}
