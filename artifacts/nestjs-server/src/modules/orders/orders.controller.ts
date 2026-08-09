import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { OrderStatus } from '../../common/enums/order-status.enum';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private service: OrdersService) {}

  @Get()
  findAll(@Query('status') status?: OrderStatus, @Query('tableId') tid?: number) {
    return this.service.findAll(status, tid ? +tid : undefined);
  }

  @Get('stats')
  getStats() { return this.service.getDashboardStats(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: OrderStatus) {
    return this.service.updateStatus(id, status);
  }

  @Patch(':id/items')
  addItems(@Param('id', ParseIntPipe) id: number, @Body('items') items: any[]) {
    return this.service.addItems(id, items);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
