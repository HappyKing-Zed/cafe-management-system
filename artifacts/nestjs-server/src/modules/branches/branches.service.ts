import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '../../entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(@InjectRepository(Branch) private repo: Repository<Branch>) {}

  findAll(restaurantId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    return this.repo.find({ where, relations: ['restaurant'] });
  }

  async findOne(id: number) {
    const b = await this.repo.findOne({ where: { id }, relations: ['restaurant'] });
    if (!b) throw new NotFoundException('Branch not found');
    return b;
  }

  create(data: Partial<Branch>) { return this.repo.save(this.repo.create(data)); }

  async update(id: number, data: Partial<Branch>) {
    const b = await this.findOne(id);
    Object.assign(b, data);
    return this.repo.save(b);
  }

  async remove(id: number) {
    const b = await this.findOne(id);
    return this.repo.remove(b);
  }
}
