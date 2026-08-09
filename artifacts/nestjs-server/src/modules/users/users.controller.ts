import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
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
  findAll(@Query('restaurantId') restaurantId?: number) {
    return this.service.findAll(restaurantId ? +restaurantId : undefined);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  create(@Body() body: any) {
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
