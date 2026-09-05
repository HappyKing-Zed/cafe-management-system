import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Branch } from '../../entities/branch.entity';
import { assignDefined } from '../../common/utils/assign-defined';
import { KITCHEN_WORKER_ROLES, Role } from '../../common/enums/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_FIELDS: readonly (keyof User)[] = ['name', 'email', 'role', 'isActive', 'phone', 'restaurantId', 'branchId'];
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
    @InjectRepository(Branch)
    private branchRepo: Repository<Branch>,
  ) {}

  findAll(restaurantId?: number, branchId?: number) {
    const where: any = {};
    if (restaurantId) where.restaurantId = restaurantId;
    if (branchId) where.branchId = branchId;
    return this.repo.find({ where, relations: ['branch', 'restaurant'], order: { name: 'ASC' } });
  }

  findStaffList(branchId?: number, restaurantId?: number) {
    return this.repo.find({
      where: {
        isActive: true,
        ...(branchId ? { branchId } : {}),
        ...(restaurantId ? { restaurantId } : {}),
      },
      select: ['id', 'name', 'role'],
      order: { name: 'ASC' as any },
    });
  }

  findWaiters(branchId?: number, restaurantId?: number) {
    return this.repo.find({
      where: { role: 'waiter' as any, isActive: true, ...(branchId ? { branchId } : {}), ...(restaurantId ? { restaurantId } : {}) },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
  }

  findChefs(branchId?: number, restaurantId?: number) {
    return this.repo.find({
      where: {
        role: Role.CHEF,
        isActive: true,
        ...(branchId ? { branchId } : {}),
        ...(restaurantId ? { restaurantId } : {}),
      },
      select: ['id', 'name'],
      order: { name: 'ASC' },
    });
  }

  findKitchenWorkers(branchId?: number, restaurantId?: number) {
    return this.repo.find({
      where: {
        role: In(KITCHEN_WORKER_ROLES),
        isActive: true,
        ...(branchId ? { branchId } : {}),
        ...(restaurantId ? { restaurantId } : {}),
      },
      select: ['id', 'name', 'role', 'branchId', 'restaurantId'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number) {
    const user = await this.repo.findOne({ where: { id }, relations: ['branch', 'restaurant'] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findOneForActor(id: number, actor: User) {
    const user = await this.findOne(id);
    this.assertCanManage(actor, user);
    return user;
  }

  async create(data: CreateUserDto, actor: User) {
    const target = { ...data } as Partial<User>;
    this.applyActorScope(actor, target);
    await this.validateAssignment(target.restaurantId, target.branchId);
    this.validateStoreRoleAssignment(target.role, target.branchId);
    this.assertRoleAllowed(actor, target.role);
    const exists = await this.repo.findOne({ where: { email: data.email } });
    if (exists) throw new ConflictException('Email already in use');
    const hashed = await bcrypt.hash(data.password, 10);
    const user = assignDefined(this.repo.create(), target, USER_FIELDS);
    user.password = hashed;
    try {
      const saved = await this.repo.save(user);
      return this.findOne(saved.id);
    } catch (error: any) {
      if (error?.code === '23505') throw new ConflictException('Email already in use');
      throw error;
    }
  }

  async update(id: number, data: UpdateUserDto, actor: User) {
    const user = await this.findOne(id);
    this.assertCanManage(actor, user);
    const target = { ...data } as Partial<User> & { password?: string };
    this.applyActorScope(actor, target);
    const restaurantId = target.restaurantId !== undefined ? target.restaurantId : user.restaurantId;
    const branchId = target.branchId !== undefined ? target.branchId : user.branchId;
    await this.validateAssignment(restaurantId, branchId);
    this.validateStoreRoleAssignment(target.role ?? user.role, branchId);
    if (target.role !== undefined && target.role !== user.role) {
      this.assertRoleAllowed(actor, target.role);
    }
    if (target.email && target.email !== user.email) {
      const exists = await this.repo.findOne({ where: { email: target.email } });
      if (exists) throw new ConflictException('Email already in use');
    }
    if (target.password) {
      target.password = await bcrypt.hash(target.password, 10);
    }
    assignDefined(user, target, USER_FIELDS);
    // findOne() loads these relations. When their FK IDs change, retaining the
    // old relation objects can cause TypeORM to persist the previous assignment.
    if (target.restaurantId !== undefined) user.restaurant = undefined;
    if (target.branchId !== undefined) user.branch = undefined;
    if (target.password) user.password = target.password;
    try {
      await this.repo.save(user);
      return this.findOne(id);
    } catch (error: any) {
      if (error?.code === '23505') throw new ConflictException('Email already in use');
      throw error;
    }
  }

  private applyActorScope(actor: User, target: Partial<User>) {
    if (actor.role === Role.ADMIN) return;
    if (!actor.restaurantId) throw new ForbiddenException('Your account is not assigned to a restaurant');
    target.restaurantId = actor.restaurantId;
    if (actor.role === Role.MANAGER && actor.branchId) target.branchId = actor.branchId;
  }

  private assertCanManage(actor: User, target: User) {
    if (actor.role === Role.ADMIN) return;
    if (!actor.restaurantId || target.restaurantId !== actor.restaurantId) {
      throw new ForbiddenException('You can only manage staff in your restaurant');
    }
    if (actor.role === Role.MANAGER && actor.branchId && target.branchId !== actor.branchId) {
      throw new ForbiddenException('You can only manage staff in your branch');
    }
    if (actor.role === Role.MANAGER && target.id !== actor.id && [Role.ADMIN, Role.OWNER, Role.MANAGER].includes(target.role)) {
      throw new ForbiddenException('Managers cannot manage administrators, owners, or other managers');
    }
    if (actor.role === Role.OWNER && target.role === Role.ADMIN) {
      throw new ForbiddenException('Owners cannot manage administrators');
    }
  }

  private assertRoleAllowed(actor: User, role: Role) {
    if (actor.role === Role.ADMIN) return;
    if (actor.role === Role.OWNER && role !== Role.ADMIN) return;
    if (actor.role === Role.MANAGER && ![Role.ADMIN, Role.OWNER, Role.MANAGER].includes(role)) return;
    throw new ForbiddenException('You cannot assign this role');
  }

  private async validateAssignment(restaurantId?: number | null, branchId?: number | null) {
    if (!branchId) return;
    if (!restaurantId) throw new BadRequestException('A branch assignment requires a restaurant');
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new BadRequestException('Selected branch does not exist');
    if (branch.restaurantId !== restaurantId) {
      throw new BadRequestException('Selected branch does not belong to the selected restaurant');
    }
  }

  private validateStoreRoleAssignment(role?: Role, branchId?: number | null) {
    if (role === Role.BRANCH_STORE_KEEPER && !branchId) {
      throw new BadRequestException('Branch Store Keeper must be assigned to a branch');
    }
    if (role === Role.MAIN_STORE_KEEPER && branchId) {
      throw new BadRequestException('Main Store Keeper cannot be assigned to a branch');
    }
  }

  async remove(id: number, actor: User) {
    const user = await this.findOne(id);
    this.assertCanManage(actor, user);
    return this.repo.remove(user);
  }
}
