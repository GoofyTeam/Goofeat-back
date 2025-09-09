import { Injectable, Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ExpirationCheckService } from '../notifications/expiration-check.service';

interface CheckExpirationsOptions {
  dryRun?: boolean;
  ignoreSpam?: boolean;
  testSend?: boolean;
}

@Injectable()
@Command({
  name: 'check:expirations',
  description:
    'Vérifier manuellement les produits qui expirent et envoyer les notifications',
  options: { isDefault: false },
})
export class CheckExpirationsCommand extends CommandRunner {
  private readonly logger = new Logger(CheckExpirationsCommand.name);

  constructor(private readonly expirationCheckService: ExpirationCheckService) {
    super();
  }

  async run(
    passedParam: string[],
    options?: CheckExpirationsOptions,
  ): Promise<void> {
    if (options?.dryRun) {
      this.logger.log(
        'Mode preview - Analyse des utilisateurs sans envoi de notifications...',
      );

      try {
        const preview =
          await this.expirationCheckService.previewExpiringProducts(
            options.ignoreSpam,
          );

        this.logger.log(`\n=== RÉSUMÉ DE LA VÉRIFICATION ===`);
        this.logger.log(
          `Total utilisateurs avec produits expirants: ${preview.totalUsers}`,
        );
        this.logger.log(
          `Utilisateurs qui recevraient des notifications: ${preview.usersToNotify}`,
        );
        this.logger.log(
          `Utilisateurs ignorés (protection anti-spam): ${preview.usersSkippedSpam}`,
        );
        this.logger.log(
          `Utilisateurs avec notifications désactivées: ${preview.usersWithNotificationsDisabled}`,
        );

        if (preview.userDetails.length > 0) {
          this.logger.log(`\n=== DÉTAILS PAR UTILISATEUR ===`);
          preview.userDetails.forEach((user, index) => {
            this.logger.log(
              `\n${index + 1}. ${user.email} (${user.firstName})`,
            );
            this.logger.log(`   - Produits expirants: ${user.totalExpiring}`);
            this.logger.log(
              `   - Périmés: ${user.expired}, Critiques: ${user.critical}, Urgents: ${user.urgent}, À surveiller: ${user.warning}`,
            );
            this.logger.log(
              `   - Recevra notification: ${user.willReceiveNotification ? 'OUI' : 'NON'}`,
            );
            if (!user.willReceiveNotification) {
              this.logger.log(`   - Raison: ${user.skipReason}`);
            }
          });
        }

        this.logger.log('\nMode preview terminé - Aucune notification envoyée');
      } catch (error) {
        this.logger.error('Erreur lors du preview des expirations:', error);
        process.exit(1);
      }
    } else if (options?.testSend) {
      this.logger.log(
        "Mode test - Envoi réel des notifications sans enregistrer l'historique anti-spam...",
      );

      try {
        const result = await this.expirationCheckService.checkExpiringProducts(
          options.ignoreSpam,
          true, // skipHistorySave = true
        );
        this.logger.log(
          `Test terminé - Notifications envoyées à ${result} utilisateurs (historique anti-spam non sauvegardé)`,
        );
      } catch (error) {
        this.logger.error(
          "Erreur lors du test d'envoi des notifications:",
          error,
        );
        process.exit(1);
      }
    } else {
      this.logger.log(
        'Démarrage de la vérification manuelle des expirations...',
      );

      try {
        const result = await this.expirationCheckService.checkExpiringProducts(
          options?.ignoreSpam,
        );
        this.logger.log(
          `Vérification terminée - Notifications envoyées à ${result} utilisateurs`,
        );
      } catch (error) {
        this.logger.error(
          'Erreur lors de la vérification des expirations:',
          error,
        );
        process.exit(1);
      }
    }
  }

  @Option({
    flags: '-d, --dry-run',
    description:
      'Mode preview - Affiche les utilisateurs qui recevraient des notifications sans les envoyer',
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '-i, --ignore-spam',
    description:
      'Ignore la protection anti-spam et affiche/envoie à tous les utilisateurs',
  })
  parseIgnoreSpam(): boolean {
    return true;
  }

  @Option({
    flags: '--test-send',
    description:
      "Mode test - Envoie réellement les notifications mais sans sauvegarder l'historique anti-spam",
  })
  parseTestSend(): boolean {
    return true;
  }
}
