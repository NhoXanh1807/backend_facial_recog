import { Module } from '@nestjs/common';
import { RawLogService } from './raw-log.service';
import { RawLogController } from './raw-log.controller';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [MongooseModule.forFeature([])], // We'll handle models dynamically
  controllers: [RawLogController],
  providers: [RawLogService],
})
export class RawLogModule {}