import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { Stock } from '../stocks/entities/stock.entity';
import { User } from '../users/entity/user.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class ExpirationCheckService {
  private readonly logger = new Logger(ExpirationCheckService.name);

  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * vérifier les produits qui expirent dans moins de 3 jours
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringProducts(): Promise<void> {
    this.logger.log('Début de la vérification des produits qui expirent');

    try {
      // Récupérer tous les utilisateurs avec leurs préférences
      const users = await this.stockRepository.manager.find(User, {
        relations: ['stocks', 'stocks.product'],
      });

      let totalNotificationsSent = 0;
      for (const user of users) {
        // Vérifier les préférences utilisateur
        const preferences = user.preferences || {};
        const notifications = preferences.notifications || {};

        // Passer à l'utilisateur suivant si les notifications sont désactivées
        if (
          notifications.expirationAlerts === false ||
          notifications.push === false
        ) {
          continue;
        }

        const userExpiringStocks = await this.getExpiringStocksForUser(user);

        if (userExpiringStocks.length > 0) {
          const success = await this.sendExpirationNotification(
            user,
            userExpiringStocks,
          );
          if (success) {
            totalNotificationsSent++;
          }
        }
      }

      this.logger.log(
        `Notifications envoyées à ${totalNotificationsSent} utilisateurs`,
      );
    } catch (error) {
      this.logger.error(
        'Erreur lors de la vérification des expirations:',
        error,
      );
    }
  }

  async triggerExpirationCheck(): Promise<void> {
    this.logger.log('Vérification manuelle des expirations déclenchée');
    await this.checkExpiringProducts();
  }

  /**
   * Récupère les stocks qui expirent pour un utilisateur selon ses préférences
   */
  private async getExpiringStocksForUser(user: User): Promise<Stock[]> {
    const today = new Date();
    const preferences = user.preferences || {};
    const notifications = preferences.notifications || {};

    // Utiliser le nombre de jours configuré ou 3 par défaut
    const daysBefore = notifications.expirationDaysBefore || 3;
    const expirationDate = new Date();
    expirationDate.setDate(today.getDate() + daysBefore);

    return this.stockRepository.find({
      where: {
        user: { id: user.id },
        dlc: LessThanOrEqual(expirationDate),
        quantity: MoreThan(0), // Seulement les stocks non vides
      },
      relations: ['product', 'user'],
      order: {
        dlc: 'ASC',
      },
    });
  }

  /**
   * Groupe les stocks par utilisateur
   */
  private groupStocksByUser(stocks: Stock[]): Map<string, Stock[]> {
    const stocksByUser = new Map<string, Stock[]>();

    for (const stock of stocks) {
      const userId = stock.user.id;
      if (!stocksByUser.has(userId)) {
        stocksByUser.set(userId, []);
      }
      stocksByUser.get(userId)!.push(stock);
    }

    return stocksByUser;
  }

  /**
   * Envoie une notification d'expiration à un utilisateur
   */
  private async sendExpirationNotification(
    user: User,
    expiredStocks: Stock[],
  ): Promise<boolean> {
    try {
      const notification =
        this.notificationService.createExpirationNotification(expiredStocks);
      const success = await this.notificationService.sendNotificationToUser(
        user,
        notification,
      );

      if (success) {
        this.logger.log(
          `Notification envoyée à ${user.email} pour ${expiredStocks.length} produit(s)`,
        );
      } else {
        this.logger.warn(`Échec de l'envoi de notification à ${user.email}`);
      }

      return success;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de notification à ${user.email}:`,
        error,
      );
      return false;
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
    const preferences = user.preferences || {};
    const notifications = preferences.notifications || {};

    // Utiliser le nombre de jours configuré ou 3 par défaut
    const daysBefore = notifications.expirationDaysBefore || 3;
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
