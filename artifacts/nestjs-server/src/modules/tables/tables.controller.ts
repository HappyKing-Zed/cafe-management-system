import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { branchScope } from '../../common/utils/branch-scope';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { TablesService } from './tables.service';

@ApiTags('tables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tables')
export class TablesController {
  constructor(private service: TablesService) {}

  @Get()
  findAll(@Req() req: any, @Query('branchId') bid?: number) {
    // Non-admin roles only see their own branch's tables
    const scope = branchScope(req.user);
    return this.service.findAll(scope ?? (bid ? +bid : undefined));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  create(@Req() req: any, @Body() body: any) {
    const scope = branchScope(req.user);
    if (scope) body.branchId = scope;
    return this.service.create(body);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER)
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: any) {
    return this.service.updateStatus(id, status);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
