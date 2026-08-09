import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get()
  findAll(@Query('cashierId') cid?: number) { return this.service.findAll(cid ? +cid : undefined); }

  @Post()
  process(@Body() body: any) { return this.service.processPayment(body); }

  @Get('report')
  report(@Query('date') date?: string) { return this.service.getDailyReport(date); }

  @Get('shifts')
  findShifts(@Query('cashierId') cid?: number) { return this.service.findShifts(cid ? +cid : undefined); }

  @Post('shifts')
  openShift(@Body() body: any) { return this.service.openShift(body); }

  @Patch('shifts/:id/close')
  closeShift(@Param('id', ParseIntPipe) id: number, @Body('closingCash') closingCash: number) {
    return this.service.closeShift(id, closingCash);
  }
}
