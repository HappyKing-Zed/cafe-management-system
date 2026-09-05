import { Controller, Get, Logger, Patch, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private service: NotificationsService) {}

  @Get()
  async findMine(@Req() req: any) {
    // Managers/storekeepers get inventory alerts (low stock, expiry) generated on the fly
    if (['branch_store_keeper', 'manager', 'owner', 'admin'].includes(req.user?.role)) {
      await this.service.scanInventoryAlerts(req.user?.branchId || undefined).catch((error) => {
        this.logger.error('inventory alert scan failed:', error?.message || error);
      });
    }
    return this.service.findForUser(req.user);
  }

  @Patch('read')
  markAllRead(@Req() req: any) {
    return this.service.markAllRead(req.user);
  }
}
