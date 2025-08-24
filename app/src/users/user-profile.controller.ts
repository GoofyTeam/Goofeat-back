import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateBasicInfoDto } from './dto/update-basic-info.dto';
import { UpdateDietaryRestrictionsDto } from './dto/update-dietary-restrictions.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import { User } from './entity/user.entity';
import { UsersService } from './users.service';

@ApiTags('Profil Utilisateur')
@Controller({ path: 'user/profile', version: '2' })
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class UserProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: "Obtenir le profil complet de l'utilisateur connecté",
    description:
      'Récupère toutes les informations du profil utilisateur incluant les préférences et paramètres de notification',
  })
  @ApiResponse({
    status: 200,
    description: 'Profil récupéré avec succès',
    type: User,
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé - Token JWT invalide ou manquant',
  })
  @SerializationGroups('user:read')
  getProfile(@CurrentUser() user: User) {
    return user;
  }

  @Patch('basic-info')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre à jour les informations personnelles de base',
    description:
      "Met à jour le prénom, nom et email de l'utilisateur avec vérification d'unicité de l'email",
  })
  @ApiBody({ type: UpdateBasicInfoDto })
  @ApiResponse({
    status: 200,
    description: 'Informations personnelles mises à jour avec succès',
    type: User,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides - Vérifiez le format des champs',
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé - Token JWT invalide ou manquant',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflit - Cet email est déjà utilisé par un autre utilisateur',
  })
  @SerializationGroups('user:read')
  async updateBasicInfo(
    @CurrentUser() currentUser: User,
    @Body() updateBasicInfoDto: UpdateBasicInfoDto,
  ) {
    // Vérification du changement d'email
    if (
      updateBasicInfoDto.email &&
      updateBasicInfoDto.email !== currentUser.email
    ) {
      const existingUser = await this.usersService.findOneByEmail(
        updateBasicInfoDto.email,
      );
      if (existingUser) {
        throw new ConflictException(
          'Cet email est déjà utilisé par un autre utilisateur',
        );
      }
    }

    return this.usersService.update(
      currentUser.id,
      updateBasicInfoDto,
      currentUser,
    );
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Changer le mot de passe',
    description:
      "Change le mot de passe de l'utilisateur après vérification du mot de passe actuel",
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe changé avec succès',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Mot de passe mis à jour avec succès',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Données invalides - Vérifiez le format du nouveau mot de passe',
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé - Mot de passe actuel incorrect',
  })
  async changePassword(
    @CurrentUser() currentUser: User,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // Récupérer l'utilisateur avec le mot de passe (car select: false par défaut)
    const userWithPassword = await this.usersService.findOneWithPassword(
      currentUser.id,
    );

    const isPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      userWithPassword.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect');
    }

    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);
    await this.usersService.updatePassword(currentUser.id, hashedPassword);

    return { message: 'Mot de passe mis à jour avec succès' };
  }

  @Patch('dietary-restrictions')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre à jour les restrictions alimentaires',
    description:
      'Met à jour les allergènes, catégories préférées/exclues et restrictions alimentaires spécifiques',
  })
  @ApiBody({ type: UpdateDietaryRestrictionsDto })
  @ApiResponse({
    status: 200,
    description: 'Restrictions alimentaires mises à jour avec succès',
    type: User,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides - Vérifiez le format des restrictions',
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé - Token JWT invalide ou manquant',
  })
  @SerializationGroups('user:read')
  async updateDietaryRestrictions(
    @CurrentUser() currentUser: User,
    @Body() updateDietaryRestrictionsDto: UpdateDietaryRestrictionsDto,
  ) {
    const updatedPreferences = {
      ...(currentUser.preferences || {}),
      ...updateDietaryRestrictionsDto,
    };

    return this.usersService.update(
      currentUser.id,
      { preferences: updatedPreferences } as Partial<User>,
      currentUser,
    );
  }

  @Patch('notification-preferences')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre à jour les préférences de notification',
    description:
      'Configure tous les types de notifications : push, stock, recettes, foyer et mode silencieux',
  })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiResponse({
    status: 200,
    description: 'Préférences de notification mises à jour avec succès',
    type: User,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides - Vérifiez le format des préférences',
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé - Token JWT invalide ou manquant',
  })
  @SerializationGroups('user:read')
  async updateNotificationPreferences(
    @CurrentUser() currentUser: User,
    @Body() updateNotificationPreferencesDto: UpdateNotificationPreferencesDto,
  ) {
    const updatedNotificationSettings = {
      ...(currentUser.notificationSettings || {}),
      ...updateNotificationPreferencesDto,
    };

    return this.usersService.update(
      currentUser.id,
      { notificationSettings: updatedNotificationSettings } as Partial<User>,
      currentUser,
    );
  }
}
