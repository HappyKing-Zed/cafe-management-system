import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { OrdersService } from './orders.service';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { branchScope } from '../../common/utils/branch-scope';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Get()
  findAll(@Req() req: any, @Query('status') status?: OrderStatus, @Query('tableId') tid?: number) {
    // Waiters only ever see their own orders
    const waiterId = req.user?.role === Role.WAITER ? req.user.id : undefined;
    return this.service.findAll(status, tid ? +tid : undefined, waiterId, branchScope(req.user));
  }

  @Get('stats')
  async getStats(@Req() req: any) {
    const stats = await this.service.getDashboardStats(branchScope(req.user));
    // Revenue figures are only for finance-facing roles
    if (!['admin', 'owner', 'manager', 'cashier'].includes(req.user?.role)) {
      delete (stats as any).todayRevenue;
    }
    return stats;
  }

  @Get('alerts')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF)
  getAlerts(@Req() req: any) { return this.service.getAlerts(branchScope(req.user)); }

  @Get(':id')
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOneAuthorized(id, req.user);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    // Orders created by a waiter are always attributed to that waiter
    if (req.user?.role === Role.WAITER) body.waiterId = req.user.id;
    return this.service.create(body, req.user);
  }

  @Patch(':id/status')
  updateStatus(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body('status') status: OrderStatus) {
    return this.service.updateStatus(id, status, req.user);
  }

  @Patch(':id/items')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)
  addItems(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body('items') items: any[]) {
    return this.service.addItems(id, items, req.user);
  }

  @Patch(':id/items/remove')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER, Role.WAITER)
  removeItems(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body('orderItemIds') orderItemIds: number[]) {
    return this.service.removeItems(id, orderItemIds, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
