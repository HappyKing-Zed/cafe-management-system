import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
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
  findItems(@Query('restaurantId') rid?: number) { return this.service.findAllItems(rid ? +rid : undefined); }

  @Get('items/low-stock')
  lowStock(@Query('restaurantId') rid?: number) { return this.service.getLowStockItems(rid ? +rid : undefined); }

  @Get('items/:id')
  findItem(@Param('id', ParseIntPipe) id: number) { return this.service.findOneItem(id); }

  @Post('items')
  createItem(@Body() body: any) { return this.service.createItem(body); }

  @Patch('items/:id')
  updateItem(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateItem(id, body); }

  @Delete('items/:id')
  removeItem(@Param('id', ParseIntPipe) id: number) { return this.service.removeItem(id); }

  // Suppliers
  @Get('suppliers')
  findSuppliers(@Query('restaurantId') rid?: number) { return this.service.findAllSuppliers(rid ? +rid : undefined); }

  @Post('suppliers')
  createSupplier(@Body() body: any) { return this.service.createSupplier(body); }

  @Patch('suppliers/:id')
  updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateSupplier(id, body); }

  // Purchase Orders
  @Get('purchase-orders')
  findPOs(@Query('supplierId') sid?: number) { return this.service.findAllPOs(sid ? +sid : undefined); }

  @Post('purchase-orders')
  createPO(@Body() body: any, @Req() req: any) { return this.service.createPO(body, req.user); }

  @Patch('purchase-orders/:id/status')
  updatePOStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string, @Req() req: any) {
    return this.service.updatePOStatus(id, status, req.user);
  }

  // Adjustments
  @Get('adjustments')
  findAdjustments(@Query('inventoryItemId') iid?: number) { return this.service.findAllAdjustments(iid ? +iid : undefined); }

  @Post('adjustments')
  createAdjustment(@Body() body: any) { return this.service.createAdjustment(body); }
}
