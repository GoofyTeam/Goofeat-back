import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdMember } from 'src/households/entities/household-member.entity';
import { Household } from 'src/households/entities/household.entity';
import { StockLog } from 'src/stocks/entities/stock-log.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { StockLogService } from 'src/stocks/services/stock-log.service';
import { PersonalDashboardController } from './controllers/personal-dashboard.controller';
import { User } from './entity/user.entity';
import { PersonalDashboardService } from './services/personal-dashboard.service';
import { UserProfileV1Controller } from './user-profile-v1.controller';
import { UserProfileController } from './user-profile.controller';
import { UsersV1Controller } from './users-v1.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Stock,
      StockLog,
      Household,
      HouseholdMember,
    ]),
  ],
  controllers: [
    // V1 Controllers
    UsersV1Controller,
    UserProfileV1Controller,
    // V2 Controllers
    UsersController,
    UserProfileController,
    // Dashboard Controller
    PersonalDashboardController,
  ],
  providers: [UsersService, PersonalDashboardService, StockLogService],
  exports: [UsersService],
})
export class UsersModule {}
