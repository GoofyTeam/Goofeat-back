import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entity/user.entity';
import { ExpirationCheckService } from './expiration-check.service';
import { NotificationService } from './notification.service';
import { NotificationType } from './enums/notification-type.enum';

class UpdateFcmTokenDto {
  fcmToken: string;
}

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class FcmController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly expirationCheckService: ExpirationCheckService,
    private readonly notificationService: NotificationService,
  ) {}

  @Post('fcm-token')
  @ApiOperation({ summary: "Mettre à jour le token FCM de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Token FCM mis à jour avec succès' })
  @HttpCode(HttpStatus.OK)
  async updateFcmToken(
    @CurrentUser() user: User,
    @Body() updateFcmTokenDto: UpdateFcmTokenDto,
  ): Promise<{ message: string }> {
    await this.userRepository.update(user.id, {
      fcmToken: updateFcmTokenDto.fcmToken,
    });

    return { message: 'Token FCM mis à jour avec succès' };
  }

  @Post('fcm-token/remove')
  @ApiOperation({ summary: "Supprimer le token FCM de l'utilisateur" })
  @ApiResponse({ status: 200, description: 'Token FCM supprimé avec succès' })
  @HttpCode(HttpStatus.OK)
  async removeFcmToken(
    @CurrentUser() user: User,
  ): Promise<{ message: string }> {
    await this.userRepository.update(user.id, {
      fcmToken: null,
    });

    return { message: 'Token FCM supprimé avec succès' };
  }

  @Get('expiration-stats')
  @ApiOperation({
    summary: "Obtenir les statistiques d'expiration pour l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: "Statistiques d'expiration récupérées",
  })
  async getExpirationStats(@CurrentUser() user: User) {
    return this.expirationCheckService.getExpirationStatsForUser(user.id);
  }

  @Post('test-expiration-check')
  @ApiOperation({
    summary:
      'Déclencher manuellement la vérification des expirations (pour les tests)',
  })
  @ApiResponse({ status: 200, description: 'Vérification déclenchée' })
  @HttpCode(HttpStatus.OK)
  async testExpirationCheck(): Promise<{ message: string }> {
    await this.expirationCheckService.triggerExpirationCheck();
    return { message: 'Vérification des expirations déclenchée' };
  }

  @Post('test-notification')
  @ApiOperation({
    summary: "Envoyer une notification de test à l'utilisateur connecté",
  })
  @ApiResponse({ status: 200, description: 'Notification de test envoyée' })
  @HttpCode(HttpStatus.OK)
  async sendTestNotification(
    @CurrentUser() user: User,
  ): Promise<{ message: string; success: boolean }> {
    if (!user.fcmToken) {
      return {
        message: 'Aucun token FCM enregistré pour cet utilisateur',
        success: false,
      };
    }

    const testNotification = {
      title: '🧪 Notification de test',
      body: `Salut ${user.firstName} ! Votre système de notifications fonctionne parfaitement 🎉`,
      data: {
        type: NotificationType.TEST,
        timestamp: new Date().toISOString(),
        userId: user.id,
      },
    };

    const success = await this.notificationService.sendNotificationToUser(
      user,
      testNotification,
    );

    return {
      message: success
        ? 'Notification de test envoyée avec succès !'
        : "Échec de l'envoi de la notification de test",
      success,
    };
  }
}
