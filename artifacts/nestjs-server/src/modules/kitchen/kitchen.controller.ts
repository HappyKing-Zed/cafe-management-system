import { Controller, Get, Patch, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { KitchenService } from './kitchen.service';

@ApiTags('kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private service: KitchenService) {}

  @Get('board')
  getBoard() { return this.service.getBoard(); }

  @Patch('orders/:id/accept')
  accept(@Param('id', ParseIntPipe) id: number) { return this.service.acceptOrder(id); }

  @Patch('orders/:id/preparing')
  preparing(@Param('id', ParseIntPipe) id: number) { return this.service.startPreparing(id); }

  @Patch('orders/:id/ready')
  ready(@Param('id', ParseIntPipe) id: number) { return this.service.markReady(id); }
}
