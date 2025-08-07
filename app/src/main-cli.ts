import { Logger } from '@nestjs/common';
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

async function bootstrapCli() {
  const logger = new Logger('CLI');

  try {
    logger.log('🚀 Démarrage du CLI NestJS...');

    // Utiliser CommandFactory pour exécuter les commandes CLI
    await CommandFactory.run(AppModule, {
      logger: ['log', 'error', 'warn'],
      usePlugins: true,
    });

    logger.log('✅ Commande CLI terminée');
    process.exit(0);
  } catch (error) {
    logger.error("❌ Erreur lors de l'exécution de la commande:", error);
    process.exit(1);
  }
}

void bootstrapCli();
