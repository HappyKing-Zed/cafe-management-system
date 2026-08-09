import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { MenusService } from './menus.service';

@ApiTags('menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('menus')
export class MenusController {
  constructor(private service: MenusService) {}

  @Get('categories')
  findCategories(@Query('restaurantId') rid?: number) { return this.service.findAllCategories(rid ? +rid : undefined); }

  @Get('categories/:id')
  findCategory(@Param('id', ParseIntPipe) id: number) { return this.service.findOneCategory(id); }

  @Post('categories')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  createCategory(@Body() body: any) { return this.service.createCategory(body); }

  @Patch('categories/:id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateCategory(id, body); }

  @Delete('categories/:id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  removeCategory(@Param('id', ParseIntPipe) id: number) { return this.service.removeCategory(id); }

  @Get('items')
  findItems(@Query('categoryId') cid?: number) { return this.service.findAllItems(cid ? +cid : undefined); }

  @Get('items/:id')
  findItem(@Param('id', ParseIntPipe) id: number) { return this.service.findOneItem(id); }

  @Post('items')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  createItem(@Body() body: any) { return this.service.createItem(body); }

  @Patch('items/:id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  updateItem(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.updateItem(id, body); }

  @Delete('items/:id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  removeItem(@Param('id', ParseIntPipe) id: number) { return this.service.removeItem(id); }
}
