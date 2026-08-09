import { Controller, Get, Patch, Param, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { branchScope } from '../../common/utils/branch-scope';
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
  getBoard(@Req() req: any) { return this.service.getBoard(branchScope(req.user)); }

  @Patch('orders/:id/accept')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CHEF)
  accept(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.acceptOrder(id, branchScope(req.user)); }

  @Patch('orders/:id/preparing')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CHEF)
  preparing(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.startPreparing(id, branchScope(req.user)); }

  @Patch('orders/:id/ready')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CHEF)
  ready(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.markReady(id, branchScope(req.user)); }
}
