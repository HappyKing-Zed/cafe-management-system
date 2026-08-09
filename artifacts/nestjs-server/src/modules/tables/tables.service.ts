import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantTable } from '../../entities/table.entity';
import { TableStatus } from '../../common/enums/table-status.enum';

@Injectable()
export class TablesService {
  constructor(@InjectRepository(RestaurantTable) private repo: Repository<RestaurantTable>) {}

  findAll(branchId?: number) {
    const where: any = {};
    if (branchId) where.branchId = branchId;
    return this.repo.find({ where, relations: ['branch'], order: { number: 'ASC' } });
  }

  async findOne(id: number) {
    const t = await this.repo.findOne({ where: { id }, relations: ['branch'] });
    if (!t) throw new NotFoundException('Table not found');
    return t;
  }

  create(data: Partial<RestaurantTable>) { return this.repo.save(this.repo.create(data)); }

  async update(id: number, data: Partial<RestaurantTable>) {
    const t = await this.findOne(id);
    Object.assign(t, data);
    return this.repo.save(t);
  }

  async updateStatus(id: number, status: TableStatus) {
    return this.update(id, { status });
  }

  async remove(id: number) {
    const t = await this.findOne(id);
    return this.repo.remove(t);
  }
}
