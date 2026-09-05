import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe, Req, ForbiddenException } from '@nestjs/common';
import { branchScope, effectiveBranch } from '../../common/utils/branch-scope';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  findAll(@Req() req: any, @Query('restaurantId') restaurantId?: number) {
    if (req.user.role !== Role.ADMIN && !req.user.restaurantId) {
      throw new ForbiddenException('Your account is not assigned to a restaurant');
    }
    const scopedRestaurant = req.user.role === Role.ADMIN
      ? (restaurantId ? +restaurantId : undefined)
      : req.user.restaurantId;
    return this.service.findAll(scopedRestaurant, branchScope(req.user));
  }

  // Lightweight list for the item-request form (name + role only) — available to all staff
  @Get('staff-list')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.WAITER, Role.CHEF, Role.CHEF_MAIN_KITCHEN, Role.BAR_MAN, Role.JUICE_MAKER, Role.COFFEE_LADY, Role.CASHIER, Role.BRANCH_STORE_KEEPER, Role.MAIN_STORE_KEEPER)
  staffList(@Req() req: any) {
    // Always constrain to the caller's restaurant (and branch when scoped)
    if (!req.user?.restaurantId) throw new ForbiddenException('Your account is not assigned to a restaurant');
    return this.service.findStaffList(branchScope(req.user), req.user?.restaurantId);
  }

  @Get('waiters')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR, Role.CASHIER)
  findWaiters(@Req() req: any) {
    if (!req.user?.restaurantId) throw new ForbiddenException('Your account is not assigned to a restaurant');
    return this.service.findWaiters(branchScope(req.user), req.user.restaurantId);
  }

  @Get('chefs')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR)
  findChefs(@Req() req: any) {
    if (!req.user?.restaurantId) throw new ForbiddenException('Your account is not assigned to a restaurant');
    return this.service.findChefs(branchScope(req.user), req.user.restaurantId);
  }

  @Get('kitchen-workers')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER, Role.COORDINATOR)
  findKitchenWorkers(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('restaurantId') restaurantId?: string,
  ) {
    const scopedRestaurant = req.user.role === Role.ADMIN
      ? (restaurantId ? +restaurantId : req.user.restaurantId)
      : req.user.restaurantId;
    if (!scopedRestaurant) {
      throw new ForbiddenException('A restaurant scope is required to list kitchen workers');
    }
    return this.service.findKitchenWorkers(
      effectiveBranch(req.user, branchId),
      scopedRestaurant,
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  findOne(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.findOneForActor(id, req.user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  create(@Req() req: any, @Body() body: CreateUserDto) {
    return this.service.create(body, req.user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  update(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: UpdateUserDto) {
    return this.service.update(id, body, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user);
  }
}
