import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Stock } from 'src/stocks/entities/stock.entity';
import {
  StockCreatedEvent,
  StockExpirationWarningEvent,
  StockUpdatedEvent,
} from '../../stocks/events/stock.events';
import { NotificationService } from '../notification.service';

@Injectable()
export class StockListener {
  private readonly logger = new Logger(StockListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('stock.created')
  async handleStockCreated(event: StockCreatedEvent): Promise<void> {
    this.logger.log(`Stock créé: ${event.stock.id}`);

    await this.checkAndNotifyExpiration(event.stock);
  }

  @OnEvent('stock.updated')
  async handleStockUpdated(event: StockUpdatedEvent): Promise<void> {
    this.logger.log(`Stock mis à jour: ${event.stock.id}`);

    // Si la DLC a changé, vérifier à nouveau l'expiration
    if (
      event.previousDlc &&
      event.previousDlc.getTime() !== event.stock.dlc.getTime()
    ) {
      await this.checkAndNotifyExpiration(event.stock);
    }
  }

  @OnEvent('stock.expiration.warning')
  async handleExpirationWarning(
    event: StockExpirationWarningEvent,
  ): Promise<void> {
    this.logger.log(
      `Alerte d'expiration pour le stock ${event.stock.id}: ${event.daysUntilExpiration} jour(s) restant(s)`,
    );

    const notification = this.notificationService.createExpirationNotification([
      event.stock,
    ]);

    await this.notificationService.sendNotificationToUser(
      event.stock.user,
      notification,
    );
  }

  /**
   * Vérifie si un stock expire dans moins de 3 jours et envoie une notification si nécessaire
   */
  private async checkAndNotifyExpiration(stock: Stock): Promise<void> {
    const today = new Date();
    const dlc = new Date(stock.dlc);

    const preferences = stock.user.preferences || {};
    const notifications = preferences.notifications || {};

    if (
      notifications.expirationAlerts === false ||
      notifications.push === false
    ) {
      return;
    }

    const daysBefore = notifications.expirationDaysBefore || 3;
    const daysUntilExpiration = Math.ceil(
      (dlc.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (
      daysUntilExpiration <= daysBefore &&
      daysUntilExpiration >= 0 &&
      stock.quantity > 0
    ) {
      this.logger.log(
        `Produit ${stock.product?.name || 'inconnu'} expire dans ${daysUntilExpiration} jour(s)`,
      );

      const notification =
        this.notificationService.createExpirationNotification([stock]);
      await this.notificationService.sendNotificationToUser(
        stock.user,
        notification,
      );
    }
  }
}
