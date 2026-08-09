import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TablesService } from './tables.service';

@ApiTags('tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private service: TablesService) {}

  @Get()
  findAll(@Query('branchId') bid?: number) { return this.service.findAll(bid ? +bid : undefined); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: any) {
    return this.service.updateStatus(id, status);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
