import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { RestaurantsService } from './restaurants.service';

@ApiTags('restaurants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('restaurants')
export class RestaurantsController {
  constructor(private service: RestaurantsService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER)
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
