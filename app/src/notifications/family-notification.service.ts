/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { HouseholdMember } from 'src/households/entities/household-member.entity';
import { HouseholdRole } from 'src/households/enums/household-role.enum';
import { HouseholdSettingsService } from 'src/households/services/household-settings.service';
import { PendingStockAction } from 'src/stocks/entities/pending-stock-action.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { Repository } from 'typeorm';
import { NotificationType } from './enums/notification-type.enum';
import {
  NotificationPayload,
  NotificationService,
} from './notification.service';

interface HouseholdActionEvent {
  action: PendingStockAction;
  parentsToNotify: HouseholdMember[];
}

interface StockActionEvent {
  stock: Stock;
  member: HouseholdMember;
  action: any;
}

interface PendingActionProcessedEvent {
  action: PendingStockAction;
  approved: boolean;
  processedBy: User;
}

@Injectable()
export class FamilyNotificationService {
  private readonly logger = new Logger(FamilyNotificationService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly householdSettingsService: HouseholdSettingsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @OnEvent('pending.action.created')
  async handlePendingActionCreated(event: HouseholdActionEvent): Promise<void> {
    this.logger.log(`Nouvelle action en attente créée: ${event.action.id}`);

    const { action, parentsToNotify } = event;
    const household = action.stock.household;

    // Vérifier si les notifications d'actions enfants sont activées
    if (
      !household ||
      !this.householdSettingsService.shouldNotifyChildActions(household)
    ) {
      this.logger.log(
        `Notifications d'actions enfants désactivées pour le foyer ${household?.id}`,
      );
      return;
    }
    const childName =
      action.requestedBy.nickname ||
      `${action.requestedBy.user.firstName} ${action.requestedBy.user.lastName}`;
    const productName = action.stock.product.name;

    const notification: NotificationPayload = {
      title: '👶 Action enfant en attente',
      body: `${childName} demande une action sur ${productName}`,
      data: {
        type: NotificationType.GENERAL,
        actionId: action.id,
        householdId: action.stock.household!.id,
        productName: productName,
        childName: childName,
        actionType: action.actionType,
      },
    };

    // Envoyer la notification à tous les parents/admins
    for (const parent of parentsToNotify) {
      try {
        await this.notificationService.sendNotificationToUser(
          parent.user,
          notification,
        );
      } catch (error) {
        this.logger.error(
          `Erreur envoi notification à ${parent.user.email}:`,
          error,
        );
      }
    }
  }

  @OnEvent('pending.action.processed')
  async handlePendingActionProcessed(
    event: PendingActionProcessedEvent,
  ): Promise<void> {
    this.logger.log(
      `Action traitée: ${event.action.id} - ${event.approved ? 'Approuvée' : 'Rejetée'}`,
    );

    const { action, approved, processedBy } = event;
    const childUser = action.requestedBy.user;
    const productName = action.stock.product.name;
    const approverName = `${processedBy.firstName} ${processedBy.lastName}`;

    const notification: NotificationPayload = {
      title: approved ? '✅ Action approuvée' : '❌ Action rejetée',
      body: approved
        ? `${approverName} a approuvé votre action sur ${productName}`
        : `${approverName} a rejeté votre action sur ${productName}`,
      data: {
        type: NotificationType.GENERAL,
        actionId: action.id,
        approved: approved.toString(),
        productName: productName,
        approverName: approverName,
      },
    };

    // Notifier l'enfant qui a fait la demande
    try {
      await this.notificationService.sendNotificationToUser(
        childUser,
        notification,
      );
    } catch (error) {
      this.logger.error(
        `Erreur envoi notification à l'enfant ${childUser.email}:`,
        error,
      );
    }
  }

  @OnEvent('stock.child.action')
  async handleChildStockAction(event: StockActionEvent): Promise<void> {
    this.logger.log(`Action enfant immédiate sur stock: ${event.stock.id}`);

    const { stock, member, action } = event;
    const household = stock.household;

    // Vérifier si les notifications de mise à jour de stock sont activées
    if (
      !household ||
      !this.householdSettingsService.shouldNotifyStockUpdates(household)
    ) {
      this.logger.log(
        `Notifications de stock désactivées pour le foyer ${household?.id}`,
      );
      return;
    }
    const childName =
      member.nickname || `${member.user.firstName} ${member.user.lastName}`;
    const productName = stock.product.name;

    // Trouver les autres membres du foyer à notifier
    const householdMembers = await this.getHouseholdMembersToNotify(
      stock.household!.id,
      member.id,
    );

    const notification: NotificationPayload = {
      title: '📋 Mise à jour stock',
      body: `${childName} a modifié le stock de ${productName}`,
      data: {
        type: NotificationType.GENERAL,
        stockId: stock.id,
        householdId: stock.household!.id,
        productName: productName,
        childName: childName,
        actionType: action.action,
      },
    };

    // Notifier les autres membres
    for (const memberToNotify of householdMembers) {
      try {
        await this.notificationService.sendNotificationToUser(
          memberToNotify.user,
          notification,
        );
      } catch (error) {
        this.logger.error(
          `Erreur envoi notification à ${memberToNotify.user.email}:`,
          error,
        );
      }
    }
  }

  @OnEvent('stock.consumed')
  async handleStockConsumed(event: any): Promise<void> {
    const { stock, user, quantityConsumed, newQuantity } = event;

    // Si le stock appartient à un foyer, vérifier les settings et notifier les membres
    if (stock.household) {
      // Vérifier si les notifications de stock sont activées
      if (
        !this.householdSettingsService.shouldNotifyStockUpdates(stock.household)
      ) {
        this.logger.log(
          `Notifications de stock désactivées pour le foyer ${stock.household.id}`,
        );
        return;
      }
      const members = await this.getHouseholdMembersToNotify(
        stock.household.id,
      );

      const userName = `${user.firstName} ${user.lastName}`;
      const productName = stock.product.name;

      const notification: NotificationPayload = {
        title: '🍽️ Stock consommé',
        body: `${userName} a consommé ${quantityConsumed} de ${productName}`,
        data: {
          type: NotificationType.GENERAL,
          stockId: stock.id,
          householdId: stock.household.id,
          productName: productName,
          userName: userName,
          quantityConsumed: quantityConsumed.toString(),
          remainingQuantity: newQuantity.toString(),
        },
      };

      // Notifier tous les membres sauf celui qui a fait l'action
      for (const member of members) {
        if (member.user.id !== user.id) {
          try {
            await this.notificationService.sendNotificationToUser(
              member.user,
              notification,
            );
          } catch (error) {
            this.logger.error(
              `Erreur envoi notification à ${member.user.email}:`,
              error,
            );
          }
        }
      }
    }
  }

  @OnEvent('stock.empty')
  async handleStockEmpty(event: any): Promise<void> {
    const { stock, user } = event;

    // Si le stock appartient à un foyer, vérifier les settings et notifier les membres
    if (stock.household) {
      // Vérifier si les notifications de stock sont activées
      if (
        !this.householdSettingsService.shouldNotifyStockUpdates(stock.household)
      ) {
        this.logger.log(
          `Notifications de stock désactivées pour le foyer ${stock.household.id}`,
        );
        return;
      }
      const members = await this.getHouseholdMembersToNotify(
        stock.household.id,
      );

      const userName = `${user.firstName} ${user.lastName}`;
      const productName = stock.product.name;

      const notification: NotificationPayload = {
        title: '🚨 Stock épuisé',
        body: `${productName} est maintenant épuisé (action de ${userName})`,
        data: {
          type: NotificationType.GENERAL,
          stockId: stock.id,
          householdId: stock.household.id,
          productName: productName,
          userName: userName,
        },
      };

      // Notifier tous les membres
      for (const member of members) {
        try {
          await this.notificationService.sendNotificationToUser(
            member.user,
            notification,
          );
        } catch (error) {
          this.logger.error(
            `Erreur envoi notification à ${member.user.email}:`,
            error,
          );
        }
      }
    }
  }

  @OnEvent('household.member.joined')
  async handleMemberJoined(event: any): Promise<void> {
    const { household, newMember, user } = event;

    // Vérifier si les notifications de nouveaux membres sont activées
    if (!this.householdSettingsService.shouldNotifyMemberJoined(household)) {
      this.logger.log(
        `Notifications de nouveaux membres désactivées pour le foyer ${household.id}`,
      );
      return;
    }

    const userName = `${user.firstName} ${user.lastName}`;
    const householdName = household.name;

    const notification: NotificationPayload = {
      title: '🏠 Nouveau membre',
      body: `${userName} a rejoint le foyer ${householdName}`,
      data: {
        type: NotificationType.GENERAL,
        householdId: household.id,
        householdName: householdName,
        newMemberName: userName,
      },
    };

    // Notifier tous les autres membres du foyer
    for (const member of household.members) {
      if (member.id !== newMember.id) {
        try {
          await this.notificationService.sendNotificationToUser(
            member.user,
            notification,
          );
        } catch (error) {
          this.logger.error(
            `Erreur envoi notification à ${member.user.email}:`,
            error,
          );
        }
      }
    }
  }

  @OnEvent('household.member.invited')
  async handleMemberInvited(event: any): Promise<void> {
    const { household, invitedUser, inviter, role, nickname } = event;

    const inviterName = `${inviter.firstName} ${inviter.lastName}`;
    const householdName = household.name;

    const notification: NotificationPayload = {
      title: '📨 Invitation foyer',
      body: `${inviterName} vous invite à rejoindre ${householdName}`,
      data: {
        type: NotificationType.GENERAL,
        householdId: household.id,
        householdName: householdName,
        inviterName: inviterName,
        role: role,
        nickname: nickname || '',
      },
    };

    // Notifier la personne invitée
    try {
      await this.notificationService.sendNotificationToUser(
        invitedUser,
        notification,
      );
    } catch (error) {
      this.logger.error(
        `Erreur envoi invitation à ${invitedUser.email}:`,
        error,
      );
    }
  }

  /**
   * Récupère les membres du foyer à notifier
   */
  private async getHouseholdMembersToNotify(
    householdId: string,
    excludeMemberId?: string,
  ): Promise<HouseholdMember[]> {
    // Cette méthode devrait utiliser le HouseholdService, mais pour éviter les dépendances circulaires,
    // on fait une requête directe à la base
    const query = this.userRepository.manager
      .createQueryBuilder(HouseholdMember, 'hm')
      .leftJoinAndSelect('hm.user', 'user')
      .where('hm.householdId = :householdId', { householdId })
      .andWhere('hm.isActive = true');

    if (excludeMemberId) {
      query.andWhere('hm.id != :excludeMemberId', { excludeMemberId });
    }

    return query.getMany();
  }

  /**
   * Créer une notification personnalisée pour les familles
   */
  async createFamilyNotification(
    title: string,
    body: string,
    householdId: string,
    data: Record<string, string> = {},
    onlyParents: boolean = false,
  ): Promise<void> {
    const members = await this.getHouseholdMembersToNotify(householdId);

    const membersToNotify = onlyParents
      ? members.filter(
          (m) =>
            m.role === HouseholdRole.PARENT || m.role === HouseholdRole.ADMIN,
        )
      : members;

    const notification: NotificationPayload = {
      title,
      body,
      data: {
        ...data,
        type: NotificationType.GENERAL,
        householdId,
      },
    };

    for (const member of membersToNotify) {
      try {
        await this.notificationService.sendNotificationToUser(
          member.user,
          notification,
        );
      } catch (error) {
        this.logger.error(
          `Erreur envoi notification à ${member.user.email}:`,
          error,
        );
      }
    }
  }
}
