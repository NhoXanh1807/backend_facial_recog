import { Post,Controller, Get, Query, Param, ParseIntPipe,Body } from '@nestjs/common';
import { RawLogService } from './raw-log.service';
import { Cron } from '@nestjs/schedule';
import { EditClockInDto, EditClockOutDto } from './edit-clock.dto';
interface WorkStatsResult {
  employeeId: string;
  name: string;
  daysWorked: number;
  totalWorkHours: number;
}

@Controller('raw-log')
export class RawLogController {
  constructor(private readonly rawLogService: RawLogService) {}

  @Get(':year/:month/:day')
  async getDataByDate(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Param('day', ParseIntPipe) day: number,
  ) {
    return this.rawLogService.getDataByDate(year, month, day);
  }

  // Cron job: mỗi 5 phút tự động xử lý log hôm nay
  @Cron('*/5 * * * *')
  async handleCron() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    console.log(`Đang xử lý log cho ngày ${year}-${month}-${day}`);
    await this.rawLogService.processAndSaveLogs(year, month, day);
  }

  @Get('stats')
  async getWorkStats(
    @Query('startDate') startDateStr: string,
    @Query('endDate') endDateStr: string,
    @Query('employeeId') employeeId?: string,
  ): Promise<WorkStatsResult[]> {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    return this.rawLogService.getWorkStats(startDate, endDate, employeeId);
  }

@Post('edit-clock-in')
async editClockIn(@Body() body: EditClockInDto) {
  const success = await this.rawLogService.updateClockIn(
    body.employeeId,
    new Date(body.date),
    body.newClockIn,
  );
  return { success };
}

@Post('edit-clock-out')
async editClockOut(@Body() body: EditClockOutDto) {
  const success = await this.rawLogService.updateClockOut(
    body.employeeId,
    new Date(body.date),
    body.newClockOut,
  );
  return { success };
}

}
