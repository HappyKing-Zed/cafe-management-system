import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersRepo.findOne({
      where: { email },
      select: ['id', 'name', 'email', 'password', 'role', 'isActive', 'restaurantId', 'branchId'],
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account disabled');

    const { password, ...result } = user;
    const token = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    return { access_token: token, user: result };
  }

  async me(userId: number) {
    return this.usersRepo.findOne({
      where: { id: userId },
      relations: ['restaurant', 'branch'],
    });
  }
}
