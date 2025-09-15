import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { getCriticality } from './criticality';
import { NotificationHistory } from './entities/notification-history.entity';
import { NotificationType } from './enums/notification-type.enum';
import { StockWithCriticality } from './interfaces/stock-with-criticality.interface';
import { NotificationService } from './notification.service';
import { ExpirationEmailService } from './services/expiration-email.service';

@Injectable()
export class ExpirationCheckService {
  private readonly logger = new Logger(ExpirationCheckService.name);

  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(NotificationHistory)
    private readonly notificationHistoryRepository: Repository<NotificationHistory>,
    private readonly notificationService: NotificationService,
    private readonly expirationEmailService: ExpirationEmailService,
  ) {}

  /**
   * vérifier les produits qui expirent dans moins de 3 jours
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringProducts(
    ignoreSpamProtection = false,
    skipHistorySave = false,
  ): Promise<number> {
    this.logger.log('Début de la vérification des produits qui expirent');

    try {
      const users = await this.stockRepository.manager.find(User, {
        relations: ['stocks', 'stocks.product'],
      });

      let totalNotificationsSent = 0;
      for (const user of users) {
        const notificationSettings = user.notificationSettings || {};

        if (
          notificationSettings.stockExpirationEnabled === false ||
          notificationSettings.pushNotificationsEnabled === false
        ) {
          continue;
        }

        const userExpiringStocks = await this.getExpiringStocksForUser(user);

        if (userExpiringStocks.length > 0) {
          const shouldSend =
            ignoreSpamProtection ||
            (await this.shouldSendNotification(user, userExpiringStocks));

          if (shouldSend) {
            const { success, pushSent, emailSent } =
              await this.sendExpirationNotificationWithStatus(
                user,
                userExpiringStocks,
              );
            if (success) {
              totalNotificationsSent++;
              if (!skipHistorySave) {
                await this.saveNotificationHistory(
                  user,
                  userExpiringStocks,
                  pushSent,
                  emailSent,
                );
              } else {
                this.logger.log(
                  `Mode test - Historique anti-spam non sauvegardé pour ${user.email}`,
                );
              }
            }
          }
        }
      }

      this.logger.log(
        `Notifications envoyées à ${totalNotificationsSent} utilisateurs`,
      );
      return totalNotificationsSent;
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification des expirations:',
        error,
      );
      return 0;
    }
  }

  async triggerExpirationCheck(): Promise<void> {
    this.logger.log('Vérification manuelle des expirations déclenchée');
    await this.checkExpiringProducts();
  }

  /**
   * Preview des utilisateurs qui recevraient des notifications sans les envoyer
   */
  async previewExpiringProducts(ignoreSpamProtection = false): Promise<{
    totalUsers: number;
    usersToNotify: number;
    usersSkippedSpam: number;
    usersWithNotificationsDisabled: number;
    userDetails: Array<{
      email: string;
      firstName: string;
      totalExpiring: number;
      expired: number;
      critical: number;
      urgent: number;
      warning: number;
      willReceiveNotification: boolean;
      skipReason?: string;
    }>;
  }> {
    try {
      // Récupérer tous les utilisateurs avec leurs préférences
      const users = await this.stockRepository.manager.find(User, {
        relations: ['stocks', 'stocks.product'],
      });

      let totalUsers = 0;
      let usersToNotify = 0;
      let usersSkippedSpam = 0;
      let usersWithNotificationsDisabled = 0;
      const userDetails: Array<{
        email: string;
        firstName: string;
        totalExpiring: number;
        expired: number;
        critical: number;
        urgent: number;
        warning: number;
        willReceiveNotification: boolean;
        skipReason?: string;
      }> = [];

      for (const user of users) {
        // Vérifier les préférences utilisateur
        const notificationSettings = user.notificationSettings || {};

        const userExpiringStocks = await this.getExpiringStocksForUser(user);

        if (userExpiringStocks.length > 0) {
          totalUsers++;

          // Séparer par criticité pour les stats
          const expired = userExpiringStocks.filter(
            (s) => s.criticality === 'expired',
          );
          const critical = userExpiringStocks.filter(
            (s) => s.criticality === 'critical',
          );
          const urgent = userExpiringStocks.filter(
            (s) => s.criticality === 'urgent',
          );
          const warning = userExpiringStocks.filter(
            (s) => s.criticality === 'warning',
          );

          let willReceiveNotification = false;
          let skipReason = '';

          // Vérifier si les notifications sont désactivées
          if (
            notificationSettings.stockExpirationEnabled === false ||
            notificationSettings.pushNotificationsEnabled === false
          ) {
            skipReason = 'Notifications désactivées dans les préférences';
            usersWithNotificationsDisabled++;
          } else {
            // Vérifier la protection anti-spam
            const shouldSend =
              ignoreSpamProtection ||
              (await this.shouldSendNotification(user, userExpiringStocks));

            if (shouldSend) {
              willReceiveNotification = true;
              usersToNotify++;
            } else {
              skipReason =
                'Protection anti-spam (notification envoyée récemment)';
              usersSkippedSpam++;
            }
          }

          userDetails.push({
            email: user.email,
            firstName: user.firstName,
            totalExpiring: userExpiringStocks.length,
            expired: expired.length,
            critical: critical.length,
            urgent: urgent.length,
            warning: warning.length,
            willReceiveNotification,
            skipReason: willReceiveNotification ? undefined : skipReason,
          });
        }
      }

      return {
        totalUsers,
        usersToNotify,
        usersSkippedSpam,
        usersWithNotificationsDisabled,
        userDetails,
      };
    } catch (error) {
      this.logger.error('Erreur lors du preview des expirations:', error);
      throw error;
    }
  }

  /**
   * Récupère les stocks qui expirent pour un utilisateur selon ses préférences
   */
  private async getExpiringStocksForUser(
    user: User,
  ): Promise<StockWithCriticality[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const notificationSettings = user.notificationSettings || {};

    // Utiliser le nombre de jours configuré ou 7 par défaut
    const daysBefore =
      (notificationSettings.stockExpirationDays as number) || 7;
    const expirationDate = new Date();
    expirationDate.setDate(today.getDate() + daysBefore);

    const stocks = await this.stockRepository.find({
      where: {
        user: { id: user.id },
        dlc: LessThanOrEqual(expirationDate),
        quantity: MoreThan(0), // Seulement les stocks non vides
      },
      relations: ['product', 'user'],
      order: {
        dlc: 'ASC', // Tri par DLC croissante (plus urgent en premier)
      },
    });

    return stocks.map((stock): StockWithCriticality => {
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

  /**
   * Vérifie si on doit envoyer une notification (évite le spam)
   */
  private async shouldSendNotification(
    user: User,
    stocks: StockWithCriticality[],
  ): Promise<boolean> {
    const lastNotification = await this.notificationHistoryRepository.findOne({
      where: {
        user: { id: user.id },
        type: NotificationType.EXPIRATION,
        sentAt: MoreThanOrEqual(new Date(Date.now() - 24 * 60 * 60 * 1000)), // Dernières 24h
      },
      order: {
        sentAt: 'DESC',
      },
    });

    // Si pas de notification dans les dernières 24h
    if (!lastNotification) {
      return true;
    }

    // Vérifier s'il y a de nouveaux produits critiques
    const criticalStocks = stocks.filter(
      (s) => s.criticality === 'expired' || s.criticality === 'critical',
    );

    // produits critiques, on envoie même si on a déjà envoyé récemment
    if (criticalStocks.length > 0) {
      const lastCriticalCount =
        (lastNotification.metadata?.expiredCount || 0) +
        (lastNotification.metadata?.criticalCount || 0);

      // Envoyer si on a plus de produits critiques qu'avant
      return criticalStocks.length > lastCriticalCount;
    }

    return false;
  }

  /**
   * Enregistre l'historique de notification
   */
  private async saveNotificationHistory(
    user: User,
    stocks: StockWithCriticality[],
    pushSent: boolean = false,
    emailSent: boolean = false,
  ): Promise<void> {
    const expired = stocks.filter((s) => s.criticality === 'expired');
    const critical = stocks.filter((s) => s.criticality === 'critical');
    const urgent = stocks.filter((s) => s.criticality === 'urgent');
    const warning = stocks.filter((s) => s.criticality === 'warning');

    const history = this.notificationHistoryRepository.create({
      user,
      type: NotificationType.EXPIRATION,
      metadata: {
        stockIds: stocks.map((s) => s.id),
        productNames: stocks
          .slice(0, 5)
          .map((s) => s.product?.name || 'Produit'),
        expiredCount: expired.length,
        criticalCount: critical.length,
        urgentCount: urgent.length,
        warningCount: warning.length,
      },
      sentByPush: pushSent,
      sentByEmail: emailSent,
    });

    await this.notificationHistoryRepository.save(history);
  }

  /**
   * Envoie une notification d'expiration
   */
  private async sendExpirationNotificationWithStatus(
    user: User,
    expiredStocks: StockWithCriticality[],
  ): Promise<{ success: boolean; pushSent: boolean; emailSent: boolean }> {
    try {
      const notification =
        this.notificationService.createExpirationNotification(expiredStocks);

      const [pushSuccess, emailSuccess] = await Promise.all([
        this.notificationService.sendNotificationToUser(user, notification),
        this.expirationEmailService.sendExpirationEmail(user, expiredStocks),
      ]);

      if (pushSuccess) {
        this.logger.log(
          `Notification FCM envoyée à ${user.email} pour ${expiredStocks.length} produit(s)`,
        );
      } else {
        this.logger.warn(
          `Échec de l'envoi de notification FCM à ${user.email}`,
        );
      }

      if (emailSuccess) {
        this.logger.log(
          `Email d'expiration envoyé à ${user.email} pour ${expiredStocks.length} produit(s)`,
        );
      } else {
        this.logger.warn(`Échec de l'envoi d'email à ${user.email}`);
      }

      return {
        success: pushSuccess || emailSuccess,
        pushSent: pushSuccess,
        emailSent: emailSuccess,
      };
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de notification à ${user.email}:`,
        error,
      );
      return {
        success: false,
        pushSent: false,
        emailSent: false,
      };
    }
  }

  /**
   * Récupère les statistiques des expirations pour un utilisateur donné
   */
  async getExpirationStatsForUser(userId: string): Promise<{
    expiringSoon: number;
    expiredToday: number;
    totalExpiring: Stock[];
  }> {
    const user = await this.stockRepository.manager.findOne(User, {
      where: { id: userId },
    });

    if (!user) {
      return { expiringSoon: 0, expiredToday: 0, totalExpiring: [] };
    }

    const today = new Date();
    const notificationSettings = user.notificationSettings || {};

    // Utiliser le nombre de jours configuré ou 3 par défaut
    const daysBefore =
      (notificationSettings.stockExpirationDays as number) || 3;
    const expirationDate = new Date();
    expirationDate.setDate(today.getDate() + daysBefore);

    const expiringStocks = await this.stockRepository
      .createQueryBuilder('stock')
      .leftJoinAndSelect('stock.product', 'product')
      .leftJoinAndSelect('stock.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('stock.dlc <= :expirationDate', { expirationDate })
      .andWhere('stock.quantity > 0')
      .orderBy('stock.dlc', 'ASC')
      .getMany();

    const expiredToday = expiringStocks.filter((stock) => {
      const stockDate = new Date(stock.dlc);
      return stockDate.toDateString() === today.toDateString();
    }).length;

    return {
      expiringSoon: expiringStocks.length,
      expiredToday,
      totalExpiring: expiringStocks,
    };
  }
}
