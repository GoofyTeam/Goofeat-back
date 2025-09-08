import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SpoonacularInstructionsSeedService } from 'src/common/external-apis/services/spoonacular-instructions-seed.service';

interface ImportInstructionsOptions {
  maxRecipes?: number;
  batchSize?: number;
  resumeFromId?: string;
  onlyMissing?: boolean;
}

@Command({
  name: 'import:spoonacular:instructions',
  description: 'Importer les instructions des recettes Spoonacular existantes',
})
export class ImportSpoonacularInstructionsCommand extends CommandRunner {
  private readonly logger = new Logger(
    ImportSpoonacularInstructionsCommand.name,
  );

  constructor(
    private readonly spoonacularInstructionsSeedService: SpoonacularInstructionsSeedService,
  ) {
    super();
  }

  async run(
    _passedParams: string[],
    options?: ImportInstructionsOptions,
  ): Promise<void> {
    this.logger.log("🚀 Démarrage de l'import des instructions Spoonacular...");
    this.logger.log(`Configuration:`, {
      maxRecipes: options?.maxRecipes ?? 1000,
      batchSize: options?.batchSize ?? 50,
      resumeFromId: options?.resumeFromId,
      onlyMissing: options?.onlyMissing ?? true,
    });

    try {
      const result =
        await this.spoonacularInstructionsSeedService.seedInstructions({
          maxRecipes: options?.maxRecipes,
          batchSize: options?.batchSize,
          resumeFromId: options?.resumeFromId,
          onlyMissingInstructions: options?.onlyMissing,
          respectApiLimits: true,
          saveProgressFile: './spoonacular-instructions-progress.json',
        });

      this.logger.log('✅ Import des instructions terminé!');
      this.logger.log('📊 Résumé:', {
        totalProcessed: result.totalProcessed,
        totalUpdated: result.totalUpdated,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
      });

      if (result.errors.length > 0) {
        this.logger.warn(`⚠️ ${result.errors.length} erreur(s) rencontrée(s):`);
        result.errors.slice(0, 5).forEach((error) => {
          this.logger.warn(`  - ${error}`);
        });
        if (result.errors.length > 5) {
          this.logger.warn(`  ... et ${result.errors.length - 5} autre(s)`);
        }
      }

      if (result.lastProcessedId) {
        this.logger.log(`📝 Dernier ID traité: ${result.lastProcessedId}`);
        this.logger.log(
          `💡 Pour reprendre, utilisez: --resume-from-id="${result.lastProcessedId}"`,
        );
      }
    } catch (error) {
      this.logger.error("❌ Erreur lors de l'import des instructions:", error);
      throw error;
    }
  }

  @Option({
    flags: '-m, --max-recipes <number>',
    description: 'Nombre maximum de recettes à traiter (défaut: 1000)',
  })
  parseMaxRecipes(value: string): number {
    return parseInt(value, 10);
  }

  @Option({
    flags: '-b, --batch-size <number>',
    description: 'Taille des lots pour le traitement (défaut: 50)',
  })
  parseBatchSize(value: string): number {
    return parseInt(value, 10);
  }

  @Option({
    flags: '-r, --resume-from-id <id>',
    description: 'ID de la recette à partir de laquelle reprendre',
  })
  parseResumeFromId(value: string): string {
    return value;
  }

  @Option({
    flags: '--only-missing',
    description:
      'Traiter uniquement les recettes sans instructions (défaut: true)',
    defaultValue: true,
  })
  parseOnlyMissing(): boolean {
    return true;
  }

  @Option({
    flags: '--all',
    description:
      'Traiter toutes les recettes, pas seulement celles sans instructions',
  })
  parseAll(): boolean {
    return false;
  }
}
