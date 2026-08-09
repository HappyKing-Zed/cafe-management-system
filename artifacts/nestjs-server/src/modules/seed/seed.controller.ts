import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';

@ApiTags('seed')
@Controller('seed')
export class SeedController {
  constructor(private service: SeedService) {}

  @Post()
  seed() {
    return this.service.seed();
  }
}
