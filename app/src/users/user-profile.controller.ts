import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import * as bcrypt from 'bcrypt';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './entity/user.entity';
import { UsersService } from './users.service';

// Interface RequestWithUser n'est plus nécessaire avec le décorateur @CurrentUser

@Controller('user')
export class UserProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @SerializationGroups('user:read')
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @SerializationGroups('user:read')
  async updateProfile(
    @CurrentUser() currentUser: User,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = currentUser.id;
    const user = await this.usersService.findOne(userId);

    // Vérification du changement d'email
    if (updateProfileDto.email && updateProfileDto.email !== user.email) {
      const existingUser = await this.usersService.findOneByEmail(
        updateProfileDto.email,
      );
      if (existingUser) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
    }

    // Gestion du changement de mot de passe
    if (updateProfileDto.oldPassword && updateProfileDto.newPassword) {
      // Récupérer l'utilisateur avec le mot de passe (car select: false par défaut)
      const userWithPassword =
        await this.usersService.findOneWithPassword(userId);

      const isPasswordValid = await bcrypt.compare(
        updateProfileDto.oldPassword,
        userWithPassword.password,
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('Mot de passe actuel incorrect');
      }

      const hashedPassword = await bcrypt.hash(
        updateProfileDto.newPassword,
        10,
      );
      updateProfileDto.newPassword = undefined;
      updateProfileDto.oldPassword = undefined;

      await this.usersService.updatePassword(userId, hashedPassword);
    }

    const updateData: Partial<User> = {};

    if (updateProfileDto.firstName !== undefined) {
      updateData.firstName = updateProfileDto.firstName;
    }

    if (updateProfileDto.lastName !== undefined) {
      updateData.lastName = updateProfileDto.lastName;
    }

    if (updateProfileDto.email !== undefined) {
      updateData.email = updateProfileDto.email;
    }

    // Mise à jour des préférences
    if (updateProfileDto.preferences) {
      updateData.preferences = {
        ...(user.preferences || ({} as Record<string, unknown>)),
        ...updateProfileDto.preferences,
      };
    }

    // Mise à jour des paramètres de notification
    if (updateProfileDto.notificationSettings) {
      updateData.notificationSettings = {
        ...(user.notificationSettings || ({} as Record<string, unknown>)),
        ...updateProfileDto.notificationSettings,
      };
    }

    return this.usersService.update(userId, updateData, currentUser);
  }
}
