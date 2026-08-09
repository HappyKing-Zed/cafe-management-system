import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { BranchesService } from './branches.service';

@ApiTags('branches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('branches')
export class BranchesController {
  constructor(private service: BranchesService) {}

  @Get()
  findAll(@Query('restaurantId') rid?: number) { return this.service.findAll(rid ? +rid : undefined); }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }

  @Post()
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  create(@Body() body: any) { return this.service.create(body); }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OWNER, Role.MANAGER)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.service.update(id, body); }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
