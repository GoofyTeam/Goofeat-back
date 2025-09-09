import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../../common/mail/mail.service';
import { Stock } from '../../stocks/entities/stock.entity';
import { User } from '../../users/entity/user.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { StockWithCriticality } from '../interfaces/stock-with-criticality.interface';

interface ExpirationEmailContext {
  firstName: string;
  email: string;
  expiredItems: Array<{
    id: string;
    name: string;
    dlc: string;
    daysUntilExpiry: number;
    criticality: string;
    deleteToken: string;
  }>;
  criticalItems: Array<{
    id: string;
    name: string;
    dlc: string;
    daysUntilExpiry: number;
    deleteToken: string;
  }>;
  urgentItems: Array<{
    id: string;
    name: string;
    dlc: string;
    daysUntilExpiry: number;
    deleteToken: string;
  }>;
  warningItems: Array<{
    id: string;
    name: string;
    dlc: string;
    daysUntilExpiry: number;
    deleteToken: string;
  }>;
  totalCount: number;
  hasExpired: boolean;
  hasCritical: boolean;
  hasUrgent: boolean;
  hasWarning: boolean;
}

@Injectable()
export class ExpirationEmailService {
  private readonly logger = new Logger(ExpirationEmailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Génère un token JWT pour l'action rapide de suppression
   */
  private generateQuickActionToken(stockId: string, userId: string): string {
    return this.jwtService.sign(
      {
        stockId,
        userId,
        action: 'delete',
        type: 'quick_action',
      },
      {
        expiresIn: '7d', // Le token expire dans 7 jours
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );
  }

  /**
   * Envoie un email d'expiration avec la liste détaillée et les actions rapides
   */
  async sendExpirationEmail(
    user: User,
    stocks: StockWithCriticality[],
  ): Promise<boolean> {
    try {
      const backendUrl =
        this.configService.get<string>('BACKEND_URL') ||
        'http://localhost:3000';

      // Séparer les stocks par criticité
      const expired = stocks.filter((s) => s.criticality === 'expired');
      const critical = stocks.filter((s) => s.criticality === 'critical');
      const urgent = stocks.filter((s) => s.criticality === 'urgent');
      const warning = stocks.filter((s) => s.criticality === 'warning');

      // Formatter les dates en français
      const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      };

      // Préparer le contexte pour le template
      const context: ExpirationEmailContext = {
        firstName: user.firstName,
        email: user.email,
        expiredItems: expired.map((stock) => ({
          id: stock.id,
          name: stock.product?.name || 'Produit',
          dlc: formatDate(stock.dlc),
          daysUntilExpiry: stock.daysUntilExpiry,
          criticality: 'expired' as const,
          deleteToken: this.generateQuickActionToken(stock.id, user.id),
        })),
        criticalItems: critical.map((stock) => ({
          id: stock.id,
          name: stock.product?.name || 'Produit',
          dlc: formatDate(stock.dlc),
          daysUntilExpiry: stock.daysUntilExpiry,
          deleteToken: this.generateQuickActionToken(stock.id, user.id),
        })),
        urgentItems: urgent.map((stock) => ({
          id: stock.id,
          name: stock.product?.name || 'Produit',
          dlc: formatDate(stock.dlc),
          daysUntilExpiry: stock.daysUntilExpiry,
          deleteToken: this.generateQuickActionToken(stock.id, user.id),
        })),
        warningItems: warning.map((stock) => ({
          id: stock.id,
          name: stock.product?.name || 'Produit',
          dlc: formatDate(stock.dlc),
          daysUntilExpiry: stock.daysUntilExpiry,
          deleteToken: this.generateQuickActionToken(stock.id, user.id),
        })),
        totalCount: stocks.length,
        hasExpired: expired.length > 0,
        hasCritical: critical.length > 0,
        hasUrgent: urgent.length > 0,
        hasWarning: warning.length > 0,
      };

      // Déterminer le sujet selon la criticité
      let subject = '📅 Rappel: Produits à surveiller dans votre garde-manger';
      if (context.hasExpired) {
        subject = '🚨 URGENT: Produits périmés dans votre garde-manger !';
      } else if (context.hasCritical) {
        subject = "⚠️ Attention: Produits à consommer aujourd'hui !";
      } else if (context.hasUrgent) {
        subject = '⏰ Rappel: Produits à consommer rapidement';
      }

      // Envoyer l'email
      await this.mailService.sendGenericEmail(
        user.email,
        subject,
        'expiration-notification',
        {
          ...context,
          currentYear: new Date().getFullYear(),
          backendUrl,
        },
      );

      this.logger.log(
        `Email d'expiration envoyé à ${user.email} pour ${stocks.length} produits`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de l'email d'expiration à ${user.email}:`,
        error,
      );
      return false;
    }
  }
}
