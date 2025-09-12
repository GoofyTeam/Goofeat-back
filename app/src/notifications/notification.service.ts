/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/repository/Repository';
import { FirebaseConfig } from '../common/firebase/firebase.config';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { NotificationType } from './enums/notification-type.enum';
import { StockWithCriticality } from './interfaces/stock-with-criticality.interface';
import { getCriticality } from './criticality';

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
      this.logger.error(
        `Erreur lors de l'envoi de la notification:`,
        error instanceof Error ? error.message : String(error),
      );

      // Gérer les erreurs spécifiques
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

  createExpirationNotification(
    expiredStocks: StockWithCriticality[] | Stock[],
  ): NotificationPayload {
    const stocksWithCriticality =
      this.ensureStockWithCriticality(expiredStocks);
    const count = stocksWithCriticality.length;

    const expired = stocksWithCriticality.filter(
      (s) => s.criticality === 'expired',
    );
    const critical = stocksWithCriticality.filter(
      (s) => s.criticality === 'critical',
    );
    const urgent = stocksWithCriticality.filter(
      (s) => s.criticality === 'urgent',
    );
    const warning = stocksWithCriticality.filter(
      (s) => s.criticality === 'warning',
    );

    let title = '';
    let body = '';

    if (expired.length > 0) {
      title = '🚨 Produits périmés !';
    } else if (critical.length > 0) {
      title = "⚠️ Produits à consommer aujourd'hui !";
    } else if (urgent.length > 0) {
      title = '⏰ Produits à consommer rapidement';
    } else {
      title = '📅 Produits à surveiller';
    }

    // Corps du message avec détails par criticité
    const messages: string[] = [];
    if (expired.length > 0) {
      const names = expired
        .slice(0, 2)
        .map((s) => s.product?.name)
        .join(', ');
      messages.push(
        `${expired.length} périmé(s): ${names}${expired.length > 2 ? '...' : ''}`,
      );
    }
    if (critical.length > 0) {
      const names = critical
        .slice(0, 2)
        .map((s) => s.product?.name)
        .join(', ');
      messages.push(
        `${critical.length} expire(nt) aujourd'hui: ${names}${critical.length > 2 ? '...' : ''}`,
      );
    }
    if (urgent.length > 0) {
      const names = urgent
        .slice(0, 2)
        .map((s) => s.product?.name)
        .join(', ');
      messages.push(
        `${urgent.length} dans 1-3 jours: ${names}${urgent.length > 2 ? '...' : ''}`,
      );
    }
    if (warning.length > 0 && messages.length < 2) {
      messages.push(`${warning.length} dans 4-7 jours`);
    }

    body = messages.join(' | ');

    return {
      title,
      body: body || `${count} produit(s) à surveiller`,
      data: {
        type: NotificationType.EXPIRATION,
        count: count.toString(),
        expired: expired.length.toString(),
        critical: critical.length.toString(),
        urgent: urgent.length.toString(),
        warning: warning.length.toString(),
      },
    };
  }

  /**
   * Ensures stocks have criticality information, converting if necessary
   */
  private ensureStockWithCriticality(
    stocks: StockWithCriticality[] | Stock[],
  ): StockWithCriticality[] {
    // Check if already StockWithCriticality
    if (stocks.length === 0 || 'criticality' in stocks[0]) {
      return stocks as StockWithCriticality[];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (stocks as Stock[]).map((stock): StockWithCriticality => {
      const dlcDate = new Date(stock.dlc);
      const daysUntilExpiry = Math.ceil(
        (dlcDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      const criticality = getCriticality(daysUntilExpiry);

      return {
        ...stock,
        daysUntilExpiry,
        criticality,
      } as StockWithCriticality;
    });
  }
}
