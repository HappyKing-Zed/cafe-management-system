import { Controller, Get, Patch, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { KitchenService } from './kitchen.service';

@ApiTags('kitchen')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kitchen')
export class KitchenController {
  constructor(private service: KitchenService) {}

  @Get('board')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.CHEF)
  getBoard() { return this.service.getBoard(); }

  @Patch('orders/:id/accept')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CHEF)
  accept(@Param('id', ParseIntPipe) id: number) { return this.service.acceptOrder(id); }

  @Patch('orders/:id/preparing')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CHEF)
  preparing(@Param('id', ParseIntPipe) id: number) { return this.service.startPreparing(id); }

  @Patch('orders/:id/ready')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CHEF)
  ready(@Param('id', ParseIntPipe) id: number) { return this.service.markReady(id); }
}
