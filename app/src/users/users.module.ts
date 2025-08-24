import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entity/user.entity';
import { UserProfileV1Controller } from './user-profile-v1.controller';
import { UserProfileController } from './user-profile.controller';
import { UsersV1Controller } from './users-v1.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [
    // V1 Controllers
    UsersV1Controller,
    UserProfileV1Controller,
    // V2 Controllers
    UsersController,
    UserProfileController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
