/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { FirebaseConfig } from '../common/firebase/firebase.config';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { NotificationType } from './enums/notification-type.enum';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly firebaseConfig: FirebaseConfig,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private shouldSendNotification(user: User, type: NotificationType): boolean {
    const preferences = user.preferences || {};
    const notifications = preferences.notifications || {};

    if (notifications.push === false) {
      return false;
    }

    if (type === NotificationType.EXPIRATION) {
      if (notifications.expirationAlerts === false) {
        return false;
      }
    }

    return true;
  }

  async sendNotificationToUser(
    user: User,
    payload: NotificationPayload,
  ): Promise<boolean> {
    if (!this.firebaseConfig.isConfigured()) {
      this.logger.warn(
        "Firebase n'est pas configuré. Notification non envoyée.",
      );
      return false;
    }

    if (!user.fcmToken) {
      this.logger.warn(`Aucun token FCM pour l'utilisateur ${user.id}`);
      return false;
    }

    // Vérifier les préférences utilisateur
    if (
      !this.shouldSendNotification(
        user,
        (payload.data?.type as NotificationType) || NotificationType.GENERAL,
      )
    ) {
      this.logger.log(
        `Notifications désactivées pour l'utilisateur ${user.id}`,
      );
      return false;
    }

    const messaging = this.firebaseConfig.getMessaging();
    if (!messaging) {
      this.logger.error(
        "Impossible d'obtenir le service de messagerie Firebase",
      );
      return false;
    }

    try {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        token: user.fcmToken,
      };

      const response = await messaging.send(message);
      this.logger.log(`Notification envoyée avec succès: ${response}`);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Erreur lors de l'envoi de la notification:`,
          error.message,
        );
      } else {
        this.logger.error(
          `Erreur lors de l'envoi de la notification:`,
          error.message,
        );
      }

      if (error.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`Token FCM invalide pour l'utilisateur ${user.id}`);
        // TODO: Mettre à jour l'utilisateur pour supprimer le token invalide
        await this.userRepository.update(user.id, {
          fcmToken: null,
        });
      }

      return false;
    }
  }

  async sendBulkNotifications(
    users: User[],
    payload: NotificationPayload,
  ): Promise<{ success: number; failed: number }> {
    if (!this.firebaseConfig.isConfigured()) {
      this.logger.warn(
        "Firebase n'est pas configuré. Notifications non envoyées.",
      );
      return { success: 0, failed: users.length };
    }

    const messaging = this.firebaseConfig.getMessaging();
    if (!messaging) {
      this.logger.error(
        "Impossible d'obtenir le service de messagerie Firebase",
      );
      return { success: 0, failed: users.length };
    }

    const validTokens = users
      .filter((user) => user.fcmToken)
      .map((user) => user.fcmToken!);

    if (validTokens.length === 0) {
      this.logger.warn('Aucun token FCM valide trouvé');
      return { success: 0, failed: users.length };
    }

    try {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
        tokens: validTokens,
      };

      const response = await messaging.sendEachForMulticast(message);

      this.logger.log(
        `Notifications envoyées: ${response.successCount} succès, ${response.failureCount} échecs`,
      );

      // Log des erreurs spécifiques
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            this.logger.error(`Erreur pour le token ${idx}:`, resp.error);
          }
        });
      }

      return {
        success: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      this.logger.error(
        "Erreur lors de l'envoi des notifications en lot:",
        error,
      );
      return { success: 0, failed: users.length };
    }
  }

  createExpirationNotification(expiredStocks: Stock[]): NotificationPayload {
    const count = expiredStocks.length;
    const firstProduct = expiredStocks[0]?.product?.name || 'produit';

    if (count === 1) {
      return {
        title: '⚠️ Produit bientôt périmé',
        body: `${firstProduct} expire dans moins de 3 jours !`,
        data: {
          type: NotificationType.EXPIRATION,
          stockId: expiredStocks[0].id,
          productName: firstProduct,
        },
      };
    } else {
      return {
        title: '⚠️ Produits bientôt périmés',
        body: `${count} produits expirent dans moins de 3 jours, dont ${firstProduct}`,
        data: {
          type: NotificationType.EXPIRATION,
          count: count.toString(),
        },
      };
    }
  }
}
