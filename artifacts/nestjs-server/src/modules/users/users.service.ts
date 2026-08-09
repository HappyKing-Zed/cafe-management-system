import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  findAll(restaurantId?: number, branchId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    if (branchId) where.branchId = branchId;
    return this.repo.find({ where, relations: ['branch', 'restaurant'], order: { name: 'ASC' } });
  }

  findWaiters(branchId?: number) {
    return this.repo.find({
      where: { role: 'waiter' as any, isActive: true, ...(branchId ? { branchId } : {}) },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const user = await this.repo.findOne({ where: { id }, relations: ['branch', 'restaurant'] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: Partial<User> & { password: string }) {
    const exists = await this.repo.findOne({ where: { email: data.email } });
    if (exists) throw new ConflictException('Email already in use');
    const hashed = await bcrypt.hash(data.password, 10);
    const user = this.repo.create({ ...data, password: hashed });
    return this.repo.save(user);
  }

  async update(id: number, data: Partial<User> & { password?: string }) {
    const user = await this.findOne(id);
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    Object.assign(user, data);
    return this.repo.save(user);
  }

  async remove(id: number) {
    const user = await this.findOne(id);
    return this.repo.remove(user);
  }
}
