import { Controller, Get, Post, Patch, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { SummaryService, SummaryPeriod } from './summary.service';
import { effectiveBranch, branchScope } from '../../common/utils/branch-scope';

@ApiTags('summary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('summary')
export class SummaryController {
  constructor(private service: SummaryService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CASHIER)
  getSummary(
    @Req() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('period') period?: string,
    @Query('waiterId') waiterId?: string,
    @Query('branchId') branchId?: string,
  ) {
    const p: SummaryPeriod = ['daily', 'weekly', 'monthly', 'annual'].includes(period as any) ? (period as SummaryPeriod) : 'daily';
    // Waiters only ever see their own service
    const wid = req.user?.role === Role.WAITER ? req.user.id : (waiterId ? +waiterId : undefined);
    return this.service.getSummary({ startDate, endDate, period: p }, wid, effectiveBranch(req.user, branchId));
  }

  @Get('submissions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CASHIER)
  listSubmissions(@Req() req: any, @Query('waiterId') waiterId?: string, @Query('branchId') branchId?: string) {
    return this.service.listSubmissions(req.user, waiterId ? +waiterId : undefined, effectiveBranch(req.user, branchId));
  }

  @Post('submissions')
  @UseGuards(RolesGuard)
  @Roles(Role.WAITER)
  submitDaily(@Req() req: any) {
    return this.service.submitDaily({ id: req.user.id, branchId: branchScope(req.user) });
  }

  @Patch('submissions/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(Role.CASHIER, Role.ADMIN, Role.OWNER)
  confirm(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.confirm(id, req.user);
  }
}
