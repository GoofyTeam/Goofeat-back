import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseConfig } from '../common/firebase/firebase.config';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { ExpirationCheckService } from './expiration-check.service';
import { FcmController } from './fcm.controller';
import { StockListener } from './listeners/stock.listener';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock, User]),
    ScheduleModule.forRoot(),
    ConfigModule,
  ],
  controllers: [FcmController],
  providers: [
    FirebaseConfig,
    NotificationService,
    ExpirationCheckService,
    StockListener,
  ],
  exports: [NotificationService, ExpirationCheckService],
})
export class NotificationsModule {}
