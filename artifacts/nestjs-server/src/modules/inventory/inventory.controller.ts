import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { branchScope } from '../../common/utils/branch-scope';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.STOREKEEPER)
@Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}

  // Items
  @Get('items')
  findItems(@Req() req: any, @Query('restaurantId') rid?: number) {
    return this.service.findAllItems(rid ? +rid : undefined, branchScope(req.user));
  }

  @Get('items/low-stock')
  lowStock(@Req() req: any, @Query('restaurantId') rid?: number) {
    return this.service.getLowStockItems(rid ? +rid : undefined, branchScope(req.user));
  }

  @Get('items/:id')
  findItem(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOneItem(id, branchScope(req.user));
  }

  @Post('items')
  createItem(@Req() req: any, @Body() body: any) {
    return this.service.createItem(body, branchScope(req.user));
  }

  @Patch('items/:id')
  updateItem(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateItem(id, body, branchScope(req.user));
  }

  @Delete('items/:id')
  removeItem(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.removeItem(id, branchScope(req.user));
  }

  // Suppliers (shared across branches)
  @Get('suppliers')
  findSuppliers(@Query('restaurantId') rid?: number) { return this.service.findAllSuppliers(rid ? +rid : undefined); }

  @Post('suppliers')
  createSupplier(@Body() body: any) { return this.service.createSupplier(body); }

  @Patch('suppliers/:id')
  updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateSupplier(id, body); }

  // Purchase Orders (cashier included: they confirm payment after approval)
  @Get('purchase-orders')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.STOREKEEPER, Role.CASHIER)
  findPOs(@Req() req: any, @Query('supplierId') sid?: number) {
    return this.service.findAllPOs(sid ? +sid : undefined, branchScope(req.user));
  }

  @Post('purchase-orders')
  createPO(@Body() body: any, @Req() req: any) {
    return this.service.createPO(body, req.user, branchScope(req.user));
  }

  @Patch('purchase-orders/:id/items/approve')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  approvePOItems(@Param('id', ParseIntPipe) id: number, @Body() body: { itemIds?: number[]; all?: boolean }, @Req() req: any) {
    return this.service.approvePOItems(id, body || {}, req.user, branchScope(req.user));
  }

  @Patch('purchase-orders/:id/status')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.STOREKEEPER, Role.CASHIER)
  updatePOStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string, @Req() req: any) {
    return this.service.updatePOStatus(id, status, req.user, branchScope(req.user));
  }

  // Item Requests — every role can request items; approvals/issuing enforced in the service
  @Get('requests')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF, Role.CASHIER, Role.STOREKEEPER)
  findRequests(@Req() req: any) {
    return this.service.findAllRequests(req.user, branchScope(req.user));
  }

  @Post('requests')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF, Role.CASHIER, Role.STOREKEEPER)
  createRequest(@Req() req: any, @Body() body: any) {
    return this.service.createRequest(body, req.user, branchScope(req.user));
  }

  @Patch('requests/:id/status')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF, Role.CASHIER, Role.STOREKEEPER)
  updateRequestStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string, @Body('quantity') quantity: number, @Req() req: any) {
    return this.service.updateRequestStatus(id, status, req.user, branchScope(req.user), quantity);
  }

  // Items also readable by all roles so the request form can list them
  @Get('requestable-items')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF, Role.CASHIER, Role.STOREKEEPER)
  requestableItems(@Req() req: any) {
    return this.service.findAllItems(undefined, branchScope(req.user));
  }

  // Adjustments
  @Get('adjustments')
  findAdjustments(
    @Req() req: any,
    @Query('inventoryItemId') iid?: number,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAllAdjustments(iid ? +iid : undefined, branchScope(req.user), type, from, to);
  }

  @Post('adjustments')
  createAdjustment(@Req() req: any, @Body() body: any) {
    return this.service.createAdjustment(body, req.user, branchScope(req.user));
  }
}
