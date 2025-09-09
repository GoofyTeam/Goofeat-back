import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { FirebaseConfig } from '../common/firebase/firebase.config';
import { HouseholdMember } from '../households/entities/household-member.entity';
import { HouseholdModule } from '../households/household.module';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { MailModule } from '../common/mail/mail.module';
import { ExpirationCheckService } from './expiration-check.service';
import { FamilyNotificationService } from './family-notification.service';
import { FcmController } from './fcm.controller';
import { StockListener } from './listeners/stock.listener';
import { NotificationService } from './notification.service';
import { NotificationHistory } from './entities/notification-history.entity';
import { ExpirationEmailService } from './services/expiration-email.service';
import { QuickActionController } from './controllers/quick-action.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stock,
      User,
      HouseholdMember,
      NotificationHistory,
    ]),
    ScheduleModule.forRoot(),
    ConfigModule,
    HouseholdModule,
    MailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [FcmController, QuickActionController],
  providers: [
    FirebaseConfig,
    NotificationService,
    ExpirationCheckService,
    FamilyNotificationService,
    StockListener,
    ExpirationEmailService,
  ],
  exports: [
    NotificationService,
    ExpirationCheckService,
    FamilyNotificationService,
    ExpirationEmailService,
  ],
})
export class NotificationsModule {}
