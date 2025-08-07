import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import {
  SeedConfiguration,
  SpoonacularRecipesSeedService,
} from '../services/spoonacular-recipes-seed.service';

interface SeedSpoonacularOptions {
  batchSize?: number;
  maxRecipes?: number;
  minCompletenessScore?: number;
  completeThreshold?: number;
  cuisine?: string;
  diet?: string;
  includeNutrition?: boolean;
  dryRun?: boolean;
  resume?: boolean;
  resumeFromOffset?: number;
  progressFile?: string;
  cleanProgress?: boolean;
}

@Command({
  name: 'seed:spoonacular:recipes',
  description:
    "Importe des recettes depuis l'API Spoonacular avec mapping intelligent des ingrédients",
  options: { isDefault: false },
})
export class SeedSpoonacularRecipesCommand extends CommandRunner {
  private readonly logger = new Logger(SeedSpoonacularRecipesCommand.name);

  constructor(
    private readonly spoonacularSeedService: SpoonacularRecipesSeedService,
  ) {
    super();
  }

  async run(
    passedParam: string[],
    options: SeedSpoonacularOptions,
  ): Promise<void> {
    this.logger.log('🚀 Démarrage du seed des recettes Spoonacular...');

    // Nettoyer le fichier de progrès si demandé
    if (options.cleanProgress) {
      this.spoonacularSeedService.cleanProgress(options.progressFile);
      this.logger.log('✅ Fichier de progrès nettoyé');
      return;
    }

    if (options.dryRun) {
      this.logger.log(
        '⚠️  Mode DRY-RUN activé - Aucune donnée ne sera sauvegardée',
      );
      return;
    }

    try {
      const config: SeedConfiguration = {
        batchSize: options.batchSize || 50,
        maxRecipes: options.maxRecipes || 500,
        minCompletenessScore: options.minCompletenessScore || 60,
        completeThreshold: options.completeThreshold || 80,
        cuisine: options.cuisine,
        diet: options.diet,
        includeNutrition: options.includeNutrition || false,
        resumeFromOffset: options.resume ? undefined : options.resumeFromOffset,
        saveProgressFile: options.progressFile,
      };

      this.logger.log('Configuration du seed:', config);

      const result = await this.spoonacularSeedService.seedRecipes(config);

      // Afficher les résultats
      this.logger.log('✅ Seed terminé avec succès !');
      this.logger.log('📊 Résultats:');
      this.logger.log(`   • Recettes récupérées: ${result.totalFetched}`);
      this.logger.log(`   • Recettes créées: ${result.totalCreated}`);
      this.logger.log(`   • Recettes ignorées: ${result.totalSkipped}`);
      this.logger.log(`   • Dernier offset traité: ${result.lastOffset}`);
      this.logger.log(
        `   • Score moyen de complétude: ${result.averageCompletenessScore.toFixed(1)}%`,
      );
      this.logger.log(`   • Fichier de progrès: ${result.progressFile}`);

      if (result.missingIngredientsList.length > 0) {
        this.logger.log('⚠️  Ingrédients non mappés les plus fréquents:');
        const ingredientCounts = result.missingIngredientsList.reduce(
          (acc, ingredient) => {
            acc[ingredient] = (acc[ingredient] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

        const sortedIngredients = Object.entries(ingredientCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);

        sortedIngredients.forEach(([ingredient, count]) => {
          this.logger.log(`   • ${ingredient} (${count} fois)`);
        });
      }

      if (result.errors.length > 0) {
        this.logger.warn('⚠️  Erreurs rencontrées:');
        result.errors.slice(0, 5).forEach((error) => {
          this.logger.warn(`   • ${error}`);
        });

        if (result.errors.length > 5) {
          this.logger.warn(
            `   ... et ${result.errors.length - 5} autres erreurs`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        '❌ Erreur lors du seed des recettes Spoonacular:',
        error,
      );
      process.exit(1);
    }
  }

  @Option({
    flags: '-b, --batch-size <number>',
    description: 'Nombre de recettes par batch (défaut: 50)',
    defaultValue: 50,
  })
  parseBatchSize(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error('Le batch size doit être un nombre positif');
    }
    return parsed;
  }

  @Option({
    flags: '-m, --max-recipes <number>',
    description: 'Nombre maximum de recettes à importer (défaut: 500)',
    defaultValue: 500,
  })
  parseMaxRecipes(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(
        'Le nombre maximum de recettes doit être un nombre positif',
      );
    }
    return parsed;
  }

  @Option({
    flags: '-s, --min-completeness-score <number>',
    description: 'Score minimum de complétude requis en % (défaut: 60)',
    defaultValue: 60,
  })
  parseMinCompletenessScore(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      throw new Error('Le score minimum doit être entre 0 et 100');
    }
    return parsed;
  }

  @Option({
    flags: '-t, --complete-threshold <number>',
    description:
      'Seuil pour marquer une recette comme "complète" en % (défaut: 80)',
    defaultValue: 80,
  })
  parseCompleteThreshold(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      throw new Error('Le seuil de complétude doit être entre 0 et 100');
    }
    return parsed;
  }

  @Option({
    flags: '-c, --cuisine <string>',
    description: 'Filtrer par type de cuisine (ex: italian, french, chinese)',
  })
  parseCuisine(value: string): string {
    return value;
  }

  @Option({
    flags: '-d, --diet <string>',
    description:
      'Filtrer par régime alimentaire (ex: vegetarian, vegan, gluten-free)',
  })
  parseDiet(value: string): string {
    return value;
  }

  @Option({
    flags: '-n, --include-nutrition',
    description: "Inclure les données nutritionnelles (consomme plus d'API)",
    defaultValue: false,
  })
  parseIncludeNutrition(): boolean {
    return true;
  }

  @Option({
    flags: '--dry-run',
    description: "Mode test - n'effectue aucune modification en base",
    defaultValue: false,
  })
  parseDryRun(): boolean {
    return true;
  }

  @Option({
    flags: '--resume',
    description: 'Reprendre depuis le dernier point de sauvegarde',
    defaultValue: false,
  })
  parseResume(): boolean {
    return true;
  }

  @Option({
    flags: '--resume-from-offset <number>',
    description: 'Reprendre depuis un offset spécifique',
  })
  parseResumeFromOffset(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed < 0) {
      throw new Error("L'offset doit être un nombre positif ou zéro");
    }
    return parsed;
  }

  @Option({
    flags: '--progress-file <path>',
    description:
      'Fichier pour sauvegarder/charger le progrès (défaut: ./spoonacular-seed-progress.json)',
  })
  parseProgressFile(value: string): string {
    return value;
  }

  @Option({
    flags: '--clean-progress',
    description: 'Supprimer le fichier de progrès existant',
    defaultValue: false,
  })
  parseCleanProgress(): boolean {
    return true;
  }
}
