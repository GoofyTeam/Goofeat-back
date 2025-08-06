import { Injectable } from '@nestjs/common';
import { Household } from '../entities/household.entity';
import {
  ChildApprovalSettings,
  DEFAULT_CHILD_APPROVAL_SETTINGS,
  DEFAULT_HOUSEHOLD_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  HouseholdSettings,
  NotificationSettings,
} from '../interfaces/household-settings.interface';

@Injectable()
export class HouseholdSettingsService {
  /**
   * Récupère les settings complets du foyer avec fallback sur les défauts
   */
  getSettings(household: Household): HouseholdSettings {
    if (!household.settings) {
      return DEFAULT_HOUSEHOLD_SETTINGS;
    }

    return {
      notifications: this.getNotificationSettings(household),
      childApproval: this.getChildApprovalSettings(household),
    };
  }

  /**
   * Récupère les paramètres de notifications avec fallback
   */
  getNotificationSettings(household: Household): NotificationSettings {
    const stored = household.settings?.notifications as
      | NotificationSettings
      | undefined;

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(stored || {}),
    };
  }

  /**
   * Récupère les paramètres d'approbation enfants avec fallback
   */
  getChildApprovalSettings(household: Household): ChildApprovalSettings {
    const stored = household.settings?.childApproval as
      | ChildApprovalSettings
      | undefined;

    return {
      ...DEFAULT_CHILD_APPROVAL_SETTINGS,
      ...(stored || {}),
    };
  }

  /**
   * Vérifie si les notifications de mise à jour de stock sont activées
   */
  shouldNotifyStockUpdates(household: Household): boolean {
    return this.getNotificationSettings(household).stockUpdates ?? true;
  }

  /**
   * Vérifie si les notifications d'actions enfants sont activées
   */
  shouldNotifyChildActions(household: Household): boolean {
    return this.getNotificationSettings(household).childActions ?? true;
  }

  /**
   * Vérifie si les notifications d'expiration sont activées
   */
  shouldNotifyExpiration(household: Household): boolean {
    return this.getNotificationSettings(household).expirationAlerts ?? true;
  }

  /**
   * Vérifie si les notifications de nouveaux membres sont activées
   */
  shouldNotifyMemberJoined(household: Household): boolean {
    return this.getNotificationSettings(household).memberJoined ?? true;
  }

  /**
   * Vérifie si seuls les parents doivent être notifiés pour les approbations
   */
  shouldNotifyOnlyParentsForApproval(household: Household): boolean {
    return (
      this.getNotificationSettings(household).onlyParentsForApproval ?? true
    );
  }

  /**
   * Récupère le mode de digest des notifications
   */
  getDigestMode(
    household: Household,
  ): 'instant' | 'daily' | 'weekly' | 'disabled' {
    return this.getNotificationSettings(household).digestMode ?? 'instant';
  }

  /**
   * Vérifie si le système d'approbation des enfants est activé
   */
  isChildApprovalEnabled(household: Household): boolean {
    return this.getChildApprovalSettings(household).enabled ?? true;
  }

  /**
   * Récupère la durée d'expiration automatique des demandes (en heures)
   */
  getAutoExpireHours(household: Household): number {
    return this.getChildApprovalSettings(household).autoExpireHours ?? 24;
  }

  /**
   * Récupère la quantité maximale autorisée sans approbation
   */
  getMaxQuantityWithoutApproval(household: Household): number {
    return (
      this.getChildApprovalSettings(household).maxQuantityWithoutApproval ?? 1
    );
  }

  /**
   * Vérifie si une quantité nécessite une approbation
   */
  requiresApprovalForQuantity(household: Household, quantity: number): boolean {
    const maxWithoutApproval = this.getMaxQuantityWithoutApproval(household);
    return quantity > maxWithoutApproval;
  }

  /**
   * Calcule la date d'expiration d'une demande d'approbation
   */
  getActionExpirationDate(household: Household): Date {
    const hours = this.getAutoExpireHours(household);
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + hours);
    return expirationDate;
  }

  /**
   * Met à jour partiellement les settings d'un foyer
   */
  mergeSettings(
    currentSettings: HouseholdSettings | undefined,
    newSettings: Partial<HouseholdSettings>,
  ): HouseholdSettings {
    const current = currentSettings || {};

    return {
      notifications: {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...(current.notifications || {}),
        ...(newSettings.notifications || {}),
      },
      childApproval: {
        ...DEFAULT_CHILD_APPROVAL_SETTINGS,
        ...(current.childApproval || {}),
        ...(newSettings.childApproval || {}),
      },
    };
  }
}
