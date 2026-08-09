import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from '../../entities/restaurant.entity';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private repo: Repository<Restaurant>,
  ) {}

  findAll() {
    return this.repo.find({ relations: ['branches'], order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const r = await this.repo.findOne({ where: { id }, relations: ['branches'] });
    if (!r) throw new NotFoundException('Restaurant not found');
    return r;
  }

  create(data: Partial<Restaurant>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Restaurant>) {
    const r = await this.findOne(id);
    Object.assign(r, data);
    return this.repo.save(r);
  }

  async remove(id: number) {
    const r = await this.findOne(id);
    return this.repo.remove(r);
  }
}
