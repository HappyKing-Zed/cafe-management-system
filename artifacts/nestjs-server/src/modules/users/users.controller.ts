import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req } from '@nestjs/common';
import { branchScope } from '../../common/utils/branch-scope';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  findAll(@Req() req: any, @Query('restaurantId') restaurantId?: number) {
    return this.service.findAll(restaurantId ? +restaurantId : undefined, branchScope(req.user));
  }

  // Lightweight list for the item-request form (name + role only) — available to all staff
  @Get('staff-list')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF, Role.CASHIER, Role.STOREKEEPER)
  staffList(@Req() req: any) {
    // Always constrain to the caller's restaurant (and branch when scoped)
    return this.service.findStaffList(branchScope(req.user), req.user?.restaurantId);
  }

  @Get('waiters')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.CASHIER)
  findWaiters(@Req() req: any) {
    return this.service.findWaiters(branchScope(req.user));
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  create(@Req() req: any, @Body() body: any) {
    // Branch managers can only create staff in their own branch
    const scope = branchScope(req.user);
    if (scope) body.branchId = scope;
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
