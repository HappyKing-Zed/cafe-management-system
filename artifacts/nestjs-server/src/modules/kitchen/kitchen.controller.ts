import { Controller, Get, Patch, Param, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
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
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.CHEF, Role.CHEF_MAIN_KITCHEN, Role.BAR_MAN, Role.JUICE_MAKER, Role.COFFEE_LADY)
  getBoard(@Req() req: any) {
    return this.service.getBoard(req.user);
  }

  @Patch('orders/:id/accept')
  @Roles(Role.COORDINATOR)
  accept(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.confirmOrder(id, req.user); }

  @Patch('orders/:id/accepted')
  @Roles(Role.COORDINATOR, Role.CHEF, Role.CHEF_MAIN_KITCHEN, Role.BAR_MAN, Role.JUICE_MAKER, Role.COFFEE_LADY)
  accepted(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.acceptOrder(id, req.user); }

  @Patch('orders/:id/preparing')
  @Roles(Role.COORDINATOR, Role.CHEF, Role.CHEF_MAIN_KITCHEN, Role.BAR_MAN, Role.JUICE_MAKER, Role.COFFEE_LADY)
  preparing(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.startPreparing(id, req.user); }

  @Patch('orders/:id/ready')
  @Roles(Role.COORDINATOR, Role.CHEF, Role.CHEF_MAIN_KITCHEN, Role.BAR_MAN, Role.JUICE_MAKER, Role.COFFEE_LADY)
  ready(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.markReady(id, req.user); }
}
