/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Repository } from 'typeorm';

interface SpoonacularInstructionStep {
  number: number;
  step: string;
  ingredients?: Array<{
    id: number;
    name: string;
    localizedName: string;
    image: string;
  }>;
  equipment?: Array<{
    id: number;
    name: string;
    localizedName: string;
    image: string;
  }>;
  length?: {
    number: number;
    unit: string;
  };
}

interface SpoonacularInstruction {
  name: string;
  steps: SpoonacularInstructionStep[];
}

export interface InstructionsSeedConfiguration {
  batchSize?: number;
  maxRecipes?: number;
  resumeFromId?: string;
  saveProgressFile?: string;
  onlyMissingInstructions?: boolean;
  respectApiLimits?: boolean;
  maxRetryAttempts?: number;
  baseDelayMs?: number;
}

export interface InstructionsSeedResult {
  totalProcessed: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: string[];
  lastProcessedId: string;
  progressFile: string;
}

interface InstructionsSeedProgress {
  lastProcessedId: string;
  totalProcessed: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  config: InstructionsSeedConfiguration;
  timestamp: string;
  errors: string[];
}

@Injectable()
export class SpoonacularInstructionsSeedService {
  private readonly logger = new Logger(SpoonacularInstructionsSeedService.name);
  private readonly apiClient: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
  ) {
    const apiKey = this.configService.get('SPOONACULAR_API_KEY');
    if (!apiKey) {
      throw new Error(
        'SPOONACULAR_API_KEY is required in environment variables',
      );
    }

    this.apiClient = axios.create({
      baseURL: 'https://api.spoonacular.com',
      params: {
        apiKey,
      },
      timeout: 30000,
    });
  }

  /**
   * Met à jour les instructions des recettes Spoonacular existantes
   */
  async seedInstructions(
    config: InstructionsSeedConfiguration = {},
  ): Promise<InstructionsSeedResult> {
    const {
      batchSize = 50,
      maxRecipes = 1000,
      resumeFromId,
      saveProgressFile = './spoonacular-instructions-progress.json',
      onlyMissingInstructions = true,
      respectApiLimits = true,
      maxRetryAttempts = 3,
      baseDelayMs = 200,
    } = config;

    const progressFilePath = path.resolve(saveProgressFile);

    // Charger le progrès existant
    let existingProgress: InstructionsSeedProgress | null = null;
    if (resumeFromId !== undefined || fs.existsSync(progressFilePath)) {
      existingProgress = this.loadProgress(progressFilePath);
    }

    const startFromId = resumeFromId ?? existingProgress?.lastProcessedId;

    this.logger.log(`Début de la mise à jour des instructions Spoonacular:`, {
      batchSize,
      maxRecipes,
      startFromId,
      onlyMissingInstructions,
      resuming: !!startFromId,
    });

    const result: InstructionsSeedResult = {
      totalProcessed: existingProgress?.totalProcessed ?? 0,
      totalUpdated: existingProgress?.totalUpdated ?? 0,
      totalSkipped: existingProgress?.totalSkipped ?? 0,
      totalErrors: existingProgress?.totalErrors ?? 0,
      errors: existingProgress?.errors ?? [],
      lastProcessedId: startFromId || '',
      progressFile: progressFilePath,
    };

    try {
      // Récupérer les recettes Spoonacular existantes
      const recipes = await this.getSpoonacularRecipes(
        batchSize,
        maxRecipes,
        startFromId,
        onlyMissingInstructions,
      );

      if (recipes.length === 0) {
        this.logger.log('Aucune recette à traiter trouvée');
        return result;
      }

      this.logger.log(`${recipes.length} recettes à traiter`);

      // Traiter chaque recette
      for (let i = 0; i < recipes.length; i++) {
        const recipe = recipes[i];

        try {
          this.logger.log(
            `Traitement de la recette ${i + 1}/${recipes.length}: "${recipe.name}" (${recipe.externalId})`,
          );

          const updated = await this.updateRecipeInstructions(
            recipe,
            maxRetryAttempts,
          );

          if (updated) {
            result.totalUpdated++;
            this.logger.log(
              `✅ Instructions mises à jour pour "${recipe.name}"`,
            );
          } else {
            result.totalSkipped++;
            this.logger.debug(
              `⏭️ Recette "${recipe.name}" ignorée (aucune instruction trouvée)`,
            );
          }

          result.totalProcessed++;
          result.lastProcessedId = recipe.id;
        } catch (error) {
          // Gestion spéciale pour les erreurs de quota/rate limit
          if (error.message === 'QUOTA_EXCEEDED') {
            this.logger.error(
              '🛑 QUOTA API ÉPUISÉ - Sauvegarde du progrès et arrêt',
            );

            // Sauvegarder le progrès avant d'arrêter
            this.saveProgress(progressFilePath, {
              lastProcessedId: result.lastProcessedId,
              totalProcessed: result.totalProcessed,
              totalUpdated: result.totalUpdated,
              totalSkipped: result.totalSkipped,
              totalErrors: result.totalErrors,
              config,
              timestamp: new Date().toISOString(),
              errors: [
                ...result.errors,
                'Processus interrompu: Quota API épuisé',
              ],
            });

            result.errors.push('Processus interrompu: Quota API épuisé');
            throw new Error('QUOTA_EXCEEDED'); // Propager pour arrêter le processus
          }

          if (error.message?.startsWith('RATE_LIMIT_EXCEEDED_AFTER_RETRIES')) {
            const failedRecipeId = error.message.split(':')[1];
            this.logger.warn(
              `⚠️ Rate limit persistant pour recette ${failedRecipeId}, on continue avec la suivante`,
            );

            result.totalErrors++;
            const errorMsg = `Rate limit persistant pour recette "${recipe.name}" (${failedRecipeId})`;
            result.errors.push(errorMsg);

            // Pause plus longue avant de continuer
            await this.sleep(5000);
          } else {
            result.totalErrors++;
            const errorMsg = `Erreur lors du traitement de "${recipe.name}": ${error.message}`;
            this.logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }

        // Sauvegarder le progrès tous les 10 éléments
        if ((i + 1) % 10 === 0) {
          this.saveProgress(progressFilePath, {
            lastProcessedId: result.lastProcessedId,
            totalProcessed: result.totalProcessed,
            totalUpdated: result.totalUpdated,
            totalSkipped: result.totalSkipped,
            totalErrors: result.totalErrors,
            config,
            timestamp: new Date().toISOString(),
            errors: result.errors,
          });

          this.logger.log(
            `Progrès intermédiaire: ${result.totalUpdated} mises à jour, ${result.totalSkipped} ignorées`,
          );
        }

        // Rate limiting intelligent: pause adaptative
        let adaptiveDelay: number;
        if (respectApiLimits) {
          adaptiveDelay =
            result.totalErrors > 0 ? baseDelayMs * 2 : baseDelayMs;
        } else {
          adaptiveDelay = baseDelayMs / 2; // Mode rapide si les limites ne sont pas respectées
        }
        await this.sleep(adaptiveDelay);
      }

      // Log final
      this.logger.log('📋 Résumé de la mise à jour des instructions:', {
        totalProcessed: result.totalProcessed,
        totalUpdated: result.totalUpdated,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
      });

      return result;
    } catch (error) {
      this.logger.error(
        'Erreur fatale lors de la mise à jour des instructions:',
        error,
      );
      result.errors.push(`Erreur fatale: ${error.message}`);
      return result;
    } finally {
      // Sauvegarder le progrès final
      this.saveProgress(progressFilePath, {
        lastProcessedId: result.lastProcessedId,
        totalProcessed: result.totalProcessed,
        totalUpdated: result.totalUpdated,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
        config,
        timestamp: new Date().toISOString(),
        errors: result.errors,
      });
    }
  }

  /**
   * Récupère les recettes Spoonacular existantes dans la base
   */
  private async getSpoonacularRecipes(
    limit: number,
    maxRecipes: number,
    startFromId?: string,
    onlyMissingInstructions: boolean = true,
  ): Promise<Recipe[]> {
    const queryBuilder = this.recipeRepository
      .createQueryBuilder('recipe')
      .where('recipe.externalSource = :source', { source: 'spoonacular' })
      .andWhere('recipe.externalId IS NOT NULL');

    if (onlyMissingInstructions) {
      queryBuilder.andWhere('recipe.instructions IS NULL');
    }

    if (startFromId) {
      queryBuilder.andWhere('recipe.id > :startId', { startId: startFromId });
    }

    const recipes = await queryBuilder
      .orderBy('recipe.id', 'ASC')
      .limit(Math.min(limit, maxRecipes))
      .getMany();

    return recipes;
  }

  /**
   * Met à jour les instructions d'une recette
   */
  private async updateRecipeInstructions(
    recipe: Recipe,
    maxRetries: number = 3,
  ): Promise<boolean> {
    try {
      // Extraire l'ID Spoonacular
      const spoonacularId = this.extractSpoonacularId(recipe.externalId);
      if (!spoonacularId) {
        this.logger.warn(
          `ID Spoonacular invalide pour "${recipe.name}": ${recipe.externalId}`,
        );
        return false;
      }

      // Récupérer les instructions depuis l'API
      const instructions = await this.fetchRecipeInstructions(
        spoonacularId,
        maxRetries,
      );
      if (!instructions || instructions.length === 0) {
        this.logger.debug(
          `Aucune instruction trouvée pour "${recipe.name}" (ID: ${spoonacularId})`,
        );
        return false;
      }

      // Mettre à jour la recette
      await this.recipeRepository.update(recipe.id, {
        instructions: JSON.parse(JSON.stringify(instructions)),
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour de "${recipe.name}":`,
        error,
      );
      throw error;
    }
  }

  /**
   * Récupère les instructions depuis l'API Spoonacular avec retry intelligent
   */
  private async fetchRecipeInstructions(
    spoonacularId: number,
    maxRetries: number = 3,
  ): Promise<SpoonacularInstruction[] | null> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.apiClient.get(
          `/recipes/${spoonacularId}/analyzedInstructions`,
          {
            params: {
              stepBreakdown: true,
            },
          },
        );

        if (!response.data || !Array.isArray(response.data)) {
          return null;
        }

        // Réinitialiser le délai en cas de succès
        if (attempt > 1) {
          this.logger.log(
            `✅ Récupération réussie après ${attempt} tentatives pour recette ${spoonacularId}`,
          );
        }

        return response.data as SpoonacularInstruction[];
      } catch (error) {
        lastError = error;

        if (error.response?.status === 404) {
          this.logger.debug(
            `Recette Spoonacular ${spoonacularId} non trouvée (404)`,
          );
          return null;
        }

        if (error.response?.status === 402) {
          this.logger.error(
            '❌ LIMITE API QUOTIDIENNE ATTEINTE - Arrêt du processus',
          );
          throw new Error('QUOTA_EXCEEDED');
        }

        if (error.response?.status === 429) {
          const retryAfter = this.parseRetryAfterHeader(
            error.response?.headers,
          );
          const waitTime = retryAfter || this.calculateBackoffDelay(attempt);

          this.logger.warn(
            `⏳ Rate limit atteint pour recette ${spoonacularId} (tentative ${attempt}/${maxRetries}). Attente: ${waitTime}ms`,
          );

          if (attempt < maxRetries) {
            await this.sleep(waitTime);
            continue;
          } else {
            this.logger.error(
              `❌ Rate limit persistant après ${maxRetries} tentatives pour recette ${spoonacularId}`,
            );
            throw new Error(
              `RATE_LIMIT_EXCEEDED_AFTER_RETRIES:${spoonacularId}`,
            );
          }
        }

        // Autres erreurs temporaires (5xx)
        if (error.response?.status >= 500 && error.response?.status < 600) {
          const waitTime = this.calculateBackoffDelay(attempt);
          this.logger.warn(
            `⚠️ Erreur serveur ${error.response.status} pour recette ${spoonacularId} (tentative ${attempt}/${maxRetries}). Retry dans ${waitTime}ms`,
          );

          if (attempt < maxRetries) {
            await this.sleep(waitTime);
            continue;
          }
        }

        // Pour les autres erreurs, pas de retry
        if (attempt === 1) {
          this.logger.error(
            `Erreur API lors de la récupération des instructions pour ${spoonacularId}:`,
            error.response?.data || error.message,
          );
          throw error;
        }
      }
    }

    // Si on arrive ici, toutes les tentatives ont échoué
    this.logger.error(
      `❌ Échec définitif après ${maxRetries} tentatives pour recette ${spoonacularId}:`,
      lastError?.response?.data || lastError?.message,
    );
    throw lastError;
  }

  /**
   * Parse le header Retry-After de la réponse API
   */
  private parseRetryAfterHeader(headers: any): number | null {
    if (!headers?.['retry-after']) return null;

    const retryAfter = headers['retry-after'];
    const seconds = parseInt(retryAfter, 10);

    if (isNaN(seconds)) return null;

    // Convertir en millisecondes et ajouter un petit buffer
    return seconds * 1000 + 1000;
  }

  /**
   * Calcule le délai d'attente avec backoff exponentiel
   */
  private calculateBackoffDelay(attempt: number): number {
    // Backoff exponentiel: 2^attempt * 1000ms + jitter
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 1000; // NOSONAR 0-1000ms de variation
    return Math.min(baseDelay + jitter, 30000); // Max 30 secondes
  }

  /**
   * Extrait l'ID numérique depuis l'externalId
   */
  private extractSpoonacularId(externalId: string | undefined): number | null {
    if (!externalId) return null;

    const match = externalId.match(/spoonacular_(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Sauvegarde le progrès dans un fichier JSON
   */
  private saveProgress(
    filePath: string,
    progress: InstructionsSeedProgress,
  ): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(progress, null, 2), 'utf8');
    } catch (error) {
      this.logger.warn(
        `Impossible de sauvegarder le progrès: ${error.message}`,
      );
    }
  }

  /**
   * Charge le progrès depuis un fichier JSON
   */
  private loadProgress(filePath: string): InstructionsSeedProgress | null {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const progress = JSON.parse(content) as InstructionsSeedProgress;
        this.logger.log(
          `Progrès chargé: ${progress.totalUpdated} mises à jour, dernier ID: ${progress.lastProcessedId}`,
        );
        return progress;
      }
    } catch (error) {
      this.logger.warn(`Impossible de charger le progrès: ${error.message}`);
    }
    return null;
  }

  /**
   * Supprime le fichier de progrès
   */
  cleanProgress(filePath?: string): void {
    const targetFile = filePath || './spoonacular-instructions-progress.json';
    try {
      if (fs.existsSync(targetFile)) {
        fs.unlinkSync(targetFile);
        this.logger.log(`Fichier de progrès supprimé: ${targetFile}`);
      }
    } catch (error) {
      this.logger.warn(
        `Impossible de supprimer le fichier de progrès: ${error.message}`,
      );
    }
  }

  /**
   * Utilitaire pour créer une pause
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
