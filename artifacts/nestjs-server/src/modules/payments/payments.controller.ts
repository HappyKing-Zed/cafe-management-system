import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { branchScope } from '../../common/utils/branch-scope';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.CASHIER)
@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  findAll(@Req() req: any, @Query('cashierId') cid?: number) {
    return this.service.findAll(cid ? +cid : undefined, branchScope(req.user));
  }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.CASHIER, Role.WAITER)
  process(@Req() req: any, @Body() body: any) {
    return this.service.processPayment(body, branchScope(req.user), req.user?.id);
  }

  @Get('report')
  report(@Req() req: any, @Query('date') date?: string) {
    return this.service.getDailyReport(date, branchScope(req.user));
  }

  @Get('shifts')
  findShifts(@Req() req: any, @Query('cashierId') cid?: number) {
    return this.service.findShifts(cid ? +cid : undefined, branchScope(req.user));
  }

  @Post('shifts')
  openShift(@Req() req: any, @Body() body: any) {
    return this.service.openShift(body, branchScope(req.user));
  }

  @Patch('shifts/:id/close')
  closeShift(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body('closingCash') closingCash: number) {
    return this.service.closeShift(id, closingCash, branchScope(req.user));
  }
}
