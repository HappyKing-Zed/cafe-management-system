import { Controller, Get, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  findMine(@Req() req: any) {
    return this.service.findForUser(req.user);
  }

  @Patch('read')
  markAllRead(@Req() req: any) {
    return this.service.markAllRead(req.user);
  }
}
