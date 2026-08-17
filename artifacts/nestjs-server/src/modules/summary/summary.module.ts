import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { ServiceSubmission } from '../../entities/service-submission.entity';
import { SummaryService } from './summary.service';
import { SummaryController } from './summary.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, ServiceSubmission])],
  providers: [SummaryService],
  controllers: [SummaryController],
})
export class SummaryModule {}
