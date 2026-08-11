import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return { status: 'ok' };
  }

  @Get('nestjs-backend')
  health() {
    return { status: 'ok' };
  }
}
