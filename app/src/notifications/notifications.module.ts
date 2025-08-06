import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirebaseConfig } from '../common/firebase/firebase.config';
import { HouseholdMember } from '../households/entities/household-member.entity';
import { HouseholdModule } from '../households/household.module';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { ExpirationCheckService } from './expiration-check.service';
import { FamilyNotificationService } from './family-notification.service';
import { FcmController } from './fcm.controller';
import { StockListener } from './listeners/stock.listener';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stock, User, HouseholdMember]),
    ScheduleModule.forRoot(),
    ConfigModule,
    HouseholdModule,
  ],
  controllers: [FcmController],
  providers: [
    FirebaseConfig,
    NotificationService,
    ExpirationCheckService,
    FamilyNotificationService,
    StockListener,
  ],
  exports: [
    NotificationService,
    ExpirationCheckService,
    FamilyNotificationService,
  ],
})
export class NotificationsModule {}
