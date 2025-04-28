import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RawLogModule } from './modules/raw_log/raw-log.module';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { ScheduleModule } from '@nestjs/schedule'; // Import ScheduleModule

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'), // Lấy từ .env
        dbName: 'fc' // Chỉ định rõ kết nối tới database 'fc'
      }),
    }),
    ScheduleModule.forRoot(), // Cấu hình ScheduleModule
    RawLogModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService], // Chỉ cần AppService, không cần Reflector
})
export class AppModule {}
