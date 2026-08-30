import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MainStoreService } from './main-store.service';

@ApiTags('main-store')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory/main-store')
export class MainStoreController {
  constructor(private readonly service: MainStoreService) {}

  @Get('items')
  @Roles(Role.OWNER, Role.STOREKEEPER)
  findItems(@Req() req: any) {
    return this.service.findItems(req.user);
  }

  @Get('destinations')
  @Roles(Role.OWNER, Role.STOREKEEPER)
  findDestinations(@Req() req: any) {
    return this.service.findDestinations(req.user);
  }

  @Post('receipts')
  @Roles(Role.OWNER, Role.STOREKEEPER)
  createReceipt(@Req() req: any, @Body() body: any) {
    return this.service.createReceipt(body, req.user);
  }

  @Get('transfers')
  @Roles(Role.OWNER, Role.MANAGER, Role.STOREKEEPER)
  findTransfers(@Req() req: any) {
    return this.service.findTransfers(req.user);
  }

  @Get('requestable-items')
  @Roles(Role.OWNER, Role.MANAGER, Role.STOREKEEPER)
  findRequestableItems(@Req() req: any) {
    return this.service.findRequestableItems(req.user);
  }

  @Post('transfers')
  @Roles(Role.STOREKEEPER)
  createTransfer(@Req() req: any, @Body() body: any) {
    return this.service.createTransfer(body, req.user);
  }

  @Patch('transfers/:id/approve')
  @Roles(Role.OWNER, Role.MANAGER)
  approveTransfer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.approveTransfer(id, req.user);
  }

  @Patch('transfers/:id/reject')
  @Roles(Role.OWNER, Role.MANAGER)
  rejectTransfer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.rejectTransfer(id, req.user);
  }

  @Patch('transfers/:id/transfer')
  @Roles(Role.STOREKEEPER)
  transfer(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.transfer(id, req.user);
  }
}
