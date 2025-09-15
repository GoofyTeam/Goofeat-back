import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { HouseholdMember } from './entities/household-member.entity';
import { Household } from './entities/household.entity';
import { HouseholdController } from './household.controller';
import { HouseholdService } from './household.service';
import { HouseholdSettingsService } from './services/household-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Household, HouseholdMember, User, Stock]),
  ],
  controllers: [HouseholdController],
  providers: [HouseholdService, HouseholdSettingsService],
  exports: [HouseholdService, HouseholdSettingsService, TypeOrmModule],
})
export class HouseholdModule {}
