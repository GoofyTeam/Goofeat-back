#!/usr/bin/env ts-node
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { SpoonacularInstructionsSeedService } from '../services/spoonacular-instructions-seed.service';

const logger = new Logger('SpoonacularInstructionsSeedScript');

async function bootstrap() {
  try {
    logger.log(
      '🚀 Démarrage du script de mise à jour des instructions Spoonacular...',
    );

    const app = await NestFactory.createApplicationContext(AppModule);
    const seedService = app.get(SpoonacularInstructionsSeedService);

    // Configuration du seed
    const config = {
      batchSize: 100, // Traiter 100 recettes à la fois
      maxRecipes: 2000, // Maximum 2000 recettes
      onlyMissingInstructions: true, // Seulement les recettes sans instructions
      saveProgressFile: './spoonacular-instructions-progress.json',
    };

    // Arguments en ligne de commande
    const args = process.argv.slice(2);
    const resumeArg = args.find((arg) => arg.startsWith('--resume='));
    if (resumeArg) {
      config['resumeFromId'] = resumeArg.split('=')[1];
      logger.log(`Reprise depuis l'ID: ${config['resumeFromId']}`);
    }

    const maxRecipesArg = args.find((arg) => arg.startsWith('--max='));
    if (maxRecipesArg) {
      config.maxRecipes = parseInt(maxRecipesArg.split('=')[1], 10);
      logger.log(`Limite configurée: ${config.maxRecipes} recettes`);
    }

    const allRecipesArg = args.includes('--all');
    if (allRecipesArg) {
      config.onlyMissingInstructions = false;
      logger.log('Mode: Toutes les recettes (avec ou sans instructions)');
    }

    // Lancer le seed
    const startTime = Date.now();
    const result = await seedService.seedInstructions(config);
    const duration = (Date.now() - startTime) / 1000;

    // Rapport final
    logger.log('📊 ===========================================');
    logger.log('📊 RAPPORT FINAL - INSTRUCTIONS SPOONACULAR');
    logger.log('📊 ===========================================');
    logger.log(`⏱️  Durée totale: ${duration.toFixed(1)}s`);
    logger.log(`📝 Recettes traitées: ${result.totalProcessed}`);
    logger.log(`✅ Instructions ajoutées: ${result.totalUpdated}`);
    logger.log(`⏭️  Recettes ignorées: ${result.totalSkipped}`);
    logger.log(`❌ Erreurs rencontrées: ${result.totalErrors}`);

    if (result.errors.length > 0) {
      logger.log('🔍 Détail des erreurs:');
      result.errors.slice(0, 5).forEach((error, index) => {
        logger.error(`   ${index + 1}. ${error}`);
      });
      if (result.errors.length > 5) {
        logger.log(`   ... et ${result.errors.length - 5} autres erreurs`);
      }
    }

    logger.log(`💾 Progrès sauvegardé dans: ${result.progressFile}`);
    logger.log('📊 ===========================================');

    // Conseils pour la reprise
    if (result.lastProcessedId && result.totalErrors > 0) {
      logger.log('');
      logger.log('💡 Pour reprendre le traitement:');
      logger.log(`   ts-node ${__filename} --resume=${result.lastProcessedId}`);
    }

    await app.close();

    // Code de sortie basé sur les résultats
    if (result.totalErrors > result.totalUpdated / 2) {
      logger.error(
        "❌ Trop d'erreurs rencontrées, processus considéré comme échoué",
      );
      process.exit(1);
    } else {
      logger.log('✅ Processus terminé avec succès');
      process.exit(0);
    }
  } catch (error) {
    // Gestion spéciale des erreurs de quota pour reprise
    if (error.message === 'QUOTA_EXCEEDED') {
      logger.warn('⏰ QUOTA API ÉPUISÉ');
      logger.log(
        '💡 Le processus a été interrompu car le quota API quotidien est épuisé.',
      );
      logger.log('📋 Le progrès a été sauvegardé automatiquement.');
      logger.log(
        '🔄 Pour reprendre demain, utilisez la même commande - la reprise sera automatique.',
      );
      logger.log('');
      logger.log(
        '🕐 Les quotas Spoonacular se réinitialisent généralement à minuit UTC.',
      );
      process.exit(2); // Code spécial pour quota épuisé
    } else {
      logger.error("💥 Erreur fatale lors de l'exécution du script:", error);
      process.exit(1);
    }
  }
}

// Gestion des signaux pour un arrêt propre
process.on('SIGINT', () => {
  logger.warn('🛑 Signal SIGINT reçu, arrêt du processus...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.warn('🛑 Signal SIGTERM reçu, arrêt du processus...');
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('unhandledRejection', (reason, promise) => {
  logger.error('🚨 Promise rejetée non gérée à', promise, 'raison:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('🚨 Exception non capturée:', error);
  process.exit(1);
});

// Démarrage du script
if (require.main === module) {
  bootstrap();
}

export { bootstrap };
