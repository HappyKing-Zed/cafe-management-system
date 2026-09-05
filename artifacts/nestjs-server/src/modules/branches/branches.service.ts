import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { assignDefined } from '../../common/utils/assign-defined';

const BRANCH_FIELDS: readonly (keyof Branch)[] = ['name', 'address', 'phone', 'isActive', 'restaurantId'];

@Injectable()
export class BranchesService {
  constructor(@InjectRepository(Branch) private repo: Repository<Branch>) {}

  findAll(restaurantId?: number) {
    const where: FindOptionsWhere<Branch> = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.repo.find({ where, relations: ['restaurant'] });
  }

  async findOne(id: number) {
    const b = await this.repo.findOne({ where: { id }, relations: ['restaurant'] });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  create(data: Partial<Branch>) {
    return this.repo.save(assignDefined(this.repo.create(), data, BRANCH_FIELDS));
  }

  async update(id: number, data: Partial<Branch>) {
    const b = await this.findOne(id);
    assignDefined(b, data, BRANCH_FIELDS);
    return this.repo.save(b);
  }

  async remove(id: number) {
    const b = await this.findOne(id);
    return this.repo.remove(b);
  }
}
