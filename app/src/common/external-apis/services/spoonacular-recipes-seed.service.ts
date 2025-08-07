/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Unit } from 'src/common/units/unit.enums';
import { RecipeIngredient } from 'src/recipes/entities/recipe-ingredient.entity';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { RecipeCreatedEvent } from 'src/recipes/events/recipe.events';
import RecipeEventName from 'src/recipes/events/recipe.events.name';
import { Repository } from 'typeorm';
import {
  SpoonacularIngredient,
  SpoonacularMappingService,
} from './spoonacular-mapping.service';

interface SpoonacularRecipe {
  id: number;
  title: string;
  summary: string;
  image: string;
  readyInMinutes: number;
  cookingMinutes?: number;
  preparationMinutes?: number;
  servings: number;
  spoonacularScore: number;
  healthScore: number;
  extendedIngredients: SpoonacularIngredient[];
  dishTypes: string[];
  cuisines: string[];
  diets: string[];
  instructions?: string;
  analyzedInstructions?: any[];
}

interface SpoonacularApiResponse {
  results: SpoonacularRecipe[];
  offset: number;
  number: number;
  totalResults: number;
}

export interface SeedConfiguration {
  batchSize?: number; // Nombre de recettes par batch (défaut: 50)
  maxRecipes?: number; // Nombre maximum de recettes à importer (défaut: 500)
  minCompletenessScore?: number; // Score minimum requis (défaut: 60%)
  completeThreshold?: number; // Seuil pour marquer comme "complet" (défaut: 80%)
  cuisine?: string; // Filtrer par cuisine (optionnel)
  diet?: string; // Filtrer par régime (optionnel)
  includeNutrition?: boolean; // Inclure les données nutritionnelles (défaut: false)
  resumeFromOffset?: number; // Reprendre depuis un offset spécifique
  saveProgressFile?: string; // Fichier pour sauvegarder le progrès (défaut: './spoonacular-seed-progress.json')
}

export interface SeedResult {
  totalFetched: number;
  totalCreated: number;
  totalSkipped: number;
  averageCompletenessScore: number;
  missingIngredientsList: string[];
  errors: string[];
  lastOffset: number;
  progressFile: string;
}

interface SeedProgress {
  lastOffset: number;
  totalFetched: number;
  totalCreated: number;
  totalSkipped: number;
  config: SeedConfiguration;
  timestamp: string;
  completenessScores: number[];
  errors: string[];
}

@Injectable()
export class SpoonacularRecipesSeedService {
  private readonly logger = new Logger(SpoonacularRecipesSeedService.name);
  private readonly apiClient: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
    private readonly mappingService: SpoonacularMappingService,
    private readonly eventEmitter: EventEmitter2,
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
   * Démarre le processus de seed des recettes Spoonacular
   */
  async seedRecipes(config: SeedConfiguration = {}): Promise<SeedResult> {
    const {
      batchSize = 50,
      maxRecipes = 500,
      minCompletenessScore = 60,
      completeThreshold = 80,
      cuisine,
      diet,
      includeNutrition = false,
      resumeFromOffset,
      saveProgressFile = './spoonacular-seed-progress.json',
    } = config;

    const progressFilePath = path.resolve(saveProgressFile);

    // Charger le progrès existant si demandé ou si un fichier existe
    let existingProgress: SeedProgress | null = null;
    if (resumeFromOffset !== undefined || fs.existsSync(progressFilePath)) {
      existingProgress = this.loadProgress(progressFilePath);
    }

    const startOffset = resumeFromOffset ?? existingProgress?.lastOffset ?? 0;

    this.logger.log(`Début du seed Spoonacular avec la configuration:`, {
      batchSize,
      maxRecipes,
      minCompletenessScore,
      completeThreshold,
      cuisine,
      diet,
      startOffset,
      resuming: startOffset > 0,
    });

    const result: SeedResult = {
      totalFetched: existingProgress?.totalFetched ?? 0,
      totalCreated: existingProgress?.totalCreated ?? 0,
      totalSkipped: existingProgress?.totalSkipped ?? 0,
      averageCompletenessScore: 0,
      missingIngredientsList: [],
      errors: existingProgress?.errors ?? [],
      lastOffset: startOffset,
      progressFile: progressFilePath,
    };

    let offset = startOffset;
    const completenessScores: number[] =
      existingProgress?.completenessScores ?? [];

    try {
      while (result.totalFetched < maxRecipes) {
        const remainingRecipes = maxRecipes - result.totalFetched;
        const currentBatchSize = Math.min(batchSize, remainingRecipes);

        this.logger.log(
          `Récupération du batch ${Math.floor(offset / batchSize) + 1} (${currentBatchSize} recettes, offset: ${offset})`,
        );

        // Fetch recipes from Spoonacular API
        const spoonacularRecipes = await this.fetchRecipesFromApi(
          currentBatchSize,
          offset,
          { cuisine, diet, includeNutrition },
        );

        if (spoonacularRecipes.length === 0) {
          if (result.totalFetched >= maxRecipes) {
            this.logger.log(
              `🎯 Limite configurée atteinte (${maxRecipes} recettes), arrêt du seed`,
            );
          } else {
            this.logger.warn(
              '⚠️ Aucune recette supplémentaire trouvée - Limite API quotidienne probable, arrêt du seed',
            );
          }
          break;
        }

        // Process each recipe
        for (const spoonacularRecipe of spoonacularRecipes) {
          try {
            const processResult = await this.processSpoonacularRecipe(
              spoonacularRecipe,
              minCompletenessScore,
              completeThreshold,
            );

            if (processResult.created) {
              result.totalCreated++;
              completenessScores.push(processResult.completenessScore);

              if (processResult.missingIngredients.length > 0) {
                result.missingIngredientsList.push(
                  ...processResult.missingIngredients,
                );
              }
            } else {
              result.totalSkipped++;
              this.logger.debug(
                `Recette "${spoonacularRecipe.title}" ignorée: score trop bas (${processResult.completenessScore}%)`,
              );
            }

            result.totalFetched++;
          } catch (error) {
            const errorMsg = `Erreur lors du traitement de la recette "${spoonacularRecipe.title}": ${error.message}`;
            this.logger.error(errorMsg);
            result.errors.push(errorMsg);
          }

          // Rate limiting: pause entre chaque recette
          await this.sleep(100);
        }

        offset += currentBatchSize;
        result.lastOffset = offset;

        // Sauvegarder le progrès après chaque batch
        this.saveProgress(progressFilePath, {
          lastOffset: offset,
          totalFetched: result.totalFetched,
          totalCreated: result.totalCreated,
          totalSkipped: result.totalSkipped,
          config,
          timestamp: new Date().toISOString(),
          completenessScores,
          errors: result.errors,
        });

        this.logger.log(
          `Progrès sauvegardé: ${result.totalCreated} recettes créées, ${result.totalSkipped} ignorées, offset: ${offset}`,
        );

        // Rate limiting: pause entre chaque batch
        await this.sleep(1000);
      }

      // Calculer la moyenne des scores de complétude
      if (completenessScores.length > 0) {
        result.averageCompletenessScore =
          completenessScores.reduce((sum, score) => sum + score, 0) /
          completenessScores.length;
      }

      // Dédupliquer la liste des ingrédients manqués
      result.missingIngredientsList = [
        ...new Set(result.missingIngredientsList),
      ];

      // Log de résumé final
      if (result.totalFetched >= maxRecipes) {
        this.logger.log(
          `🎯 Seed terminé - Limite configurée atteinte (${maxRecipes} recettes)`,
        );
      } else {
        this.logger.warn(
          '⚠️ Seed interrompu - Probablement limite API quotidienne atteinte',
        );
      }

      this.logger.log('📊 Résumé du seed Spoonacular:', {
        totalFetched: result.totalFetched,
        totalCreated: result.totalCreated,
        totalSkipped: result.totalSkipped,
        scoreMovenCompl: `${result.averageCompletenessScore.toFixed(1)}%`,
        lastOffset: result.lastOffset,
        errorsCount: result.errors.length,
      });

      return result;
    } catch (error) {
      this.logger.error('Erreur fatale lors du seed Spoonacular:', error);
      result.errors.push(`Erreur fatale: ${error.message}`);
      return result;
    }
  }

  /**
   * Récupère les recettes depuis l'API Spoonacular
   */
  private async fetchRecipesFromApi(
    number: number,
    offset: number,
    filters: { cuisine?: string; diet?: string; includeNutrition?: boolean },
  ): Promise<SpoonacularRecipe[]> {
    try {
      const params: any = {
        number,
        offset,
        addRecipeInformation: true,
        fillIngredients: true,
      };

      if (filters.cuisine) params.cuisine = filters.cuisine;
      if (filters.diet) params.diet = filters.diet;
      if (filters.includeNutrition) params.includeNutrition = true;

      const response = await this.apiClient.get<SpoonacularApiResponse>(
        '/recipes/complexSearch',
        { params },
      );

      this.logger.debug(
        `API Spoonacular: ${response.data.results.length} recettes récupérées`,
      );

      // Vérifier si on a atteint la limite quotidienne API
      if (response.data.results.length === 0 && offset === 0) {
        this.logger.warn(
          "⚠️ Aucune recette retournée par l'API - Limite quotidienne possiblement atteinte",
        );
      } else if (
        response.data.results.length < number &&
        response.data.totalResults > offset + response.data.results.length
      ) {
        this.logger.warn(
          `⚠️ API a retourné moins de recettes que demandé (${response.data.results.length}/${number}) - Limite quotidienne possiblement atteinte`,
        );
      }

      return response.data.results;
    } catch (error) {
      // Analyser le type d'erreur API
      if (error.response?.status === 402) {
        this.logger.error(
          '❌ LIMITE API QUOTIDIENNE ATTEINTE - Quota exceeded',
        );
        throw new Error('QUOTA_EXCEEDED');
      } else if (error.response?.status === 429) {
        this.logger.error('❌ RATE LIMIT ATTEINT - Trop de requêtes');
        throw new Error('RATE_LIMIT_EXCEEDED');
      } else {
        this.logger.error(
          "Erreur lors de l'appel API Spoonacular:",
          error.response?.data || error.message,
        );
      }
      throw new Error(`Échec de l'appel API Spoonacular: ${error.message}`);
    }
  }

  /**
   * Traite une recette Spoonacular et la convertit en entités locales
   */
  private async processSpoonacularRecipe(
    spoonacularRecipe: SpoonacularRecipe,
    minCompletenessScore: number,
    completeThreshold: number,
  ): Promise<{
    created: boolean;
    completenessScore: number;
    missingIngredients: string[];
  }> {
    const {
      id,
      title,
      summary,
      image,
      readyInMinutes,
      cookingMinutes,
      preparationMinutes,
      servings,
      extendedIngredients,
      dishTypes,
      cuisines,
    } = spoonacularRecipe;

    // Vérifier si la recette existe déjà avec une vérification plus robuste
    const existingRecipe = await this.recipeRepository.findOne({
      where: {
        externalId: `spoonacular_${id}`,
        externalSource: 'spoonacular',
      },
    });

    if (existingRecipe) {
      this.logger.debug(
        `Recette "${title}" (Spoonacular ID: ${id}) déjà existante, ignorée`,
      );
      return {
        created: false,
        completenessScore: existingRecipe.completenessScore || 0,
        missingIngredients: existingRecipe.missingIngredients || [],
      };
    }

    // Mapper les ingrédients
    const mappingResults = await Promise.all(
      extendedIngredients.map((ingredient) =>
        this.mappingService.findMapping(ingredient),
      ),
    );

    // Calculer le score de complétude
    const mappedIngredients = mappingResults.filter(
      (result) => result.ingredient !== null,
    );
    const completenessScore = Math.round(
      (mappedIngredients.length / extendedIngredients.length) * 100,
    );

    // Vérifier si la recette atteint le seuil minimum
    if (completenessScore < minCompletenessScore) {
      return {
        created: false,
        completenessScore,
        missingIngredients: mappingResults
          .filter((result) => result.ingredient === null)
          .map((result) => result.mapping?.spoonacularName || 'unknown'),
      };
    }

    // Créer la recette
    const recipe = this.recipeRepository.create({
      name: this.cleanHtmlText(title),
      description: this.cleanHtmlText(summary),
      imageUrl: image,
      preparationTime:
        preparationMinutes ||
        Math.max(0, readyInMinutes - (cookingMinutes || 0)),
      cookingTime: cookingMinutes || 0,
      servings,
      difficulty: this.mapDifficulty(readyInMinutes),
      nutriScore: this.mapNutriScore(spoonacularRecipe.healthScore),
      categories: [...dishTypes, ...cuisines].filter(Boolean),
      externalId: `spoonacular_${id}`,
      externalSource: 'spoonacular',
      completenessScore,
      isComplete: completenessScore >= completeThreshold,
      missingIngredients: mappingResults
        .filter((result) => result.ingredient === null)
        .map(
          (result) =>
            result.mapping?.spoonacularName ||
            extendedIngredients.find(
              (ing) => ing.id === result.mapping?.spoonacularId,
            )?.name ||
            'unknown',
        ),
      externalData: {
        spoonacularId: id,
        originalTitle: title,
        spoonacularScore: spoonacularRecipe.spoonacularScore,
        healthScore: spoonacularRecipe.healthScore,
        diets: spoonacularRecipe.diets,
      },
    });

    let savedRecipe;
    try {
      savedRecipe = await this.recipeRepository.save(recipe);
    } catch (error) {
      // Si c'est une erreur de contrainte unique, la recette existe déjà
      if (error.code === '23505' && error.constraint?.includes('external')) {
        this.logger.debug(
          `Recette "${title}" (Spoonacular ID: ${id}) existe déjà (contrainte unique), ignorée`,
        );
        return {
          created: false,
          completenessScore,
          missingIngredients: mappingResults
            .filter((result) => result.ingredient === null)
            .map((result) => result.mapping?.spoonacularName || 'unknown'),
        };
      }
      throw error;
    }

    // Créer les ingrédients mappés
    const recipeIngredients = mappedIngredients.map((result) => {
      const spoonacularIngredient = extendedIngredients.find(
        (ing) => ing.id === result.mapping?.spoonacularId,
      );

      return this.recipeIngredientRepository.create({
        recipeId: savedRecipe.id,
        ingredientId: result.ingredient!.id,
        quantity: spoonacularIngredient?.amount || 1,
        unit: this.mapUnit(spoonacularIngredient?.unit || 'piece'),
        isOptional: false,
      });
    });

    if (recipeIngredients.length > 0) {
      await this.recipeIngredientRepository.save(recipeIngredients);
    }

    // Récupérer la recette complète avec ses relations
    const finalRecipe = await this.recipeRepository.findOne({
      where: { id: savedRecipe.id },
      relations: ['ingredients', 'ingredients.ingredient'],
    });

    if (finalRecipe) {
      // Émettre l'événement de création pour indexation Elasticsearch
      await this.eventEmitter.emitAsync(
        RecipeEventName.RecipeCreated,
        new RecipeCreatedEvent(finalRecipe),
      );

      this.logger.log(
        `Recette "${title}" créée avec succès (${completenessScore}% complet, ${mappedIngredients.length}/${extendedIngredients.length} ingrédients)`,
      );
    }

    return {
      created: true,
      completenessScore,
      missingIngredients: mappingResults
        .filter((result) => result.ingredient === null)
        .map((result) => result.mapping?.spoonacularName || 'unknown'),
    };
  }

  /**
   * Nettoie le texte HTML (retire les balises)
   */
  private cleanHtmlText(text: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '') // Supprimer les balises HTML
      .replace(/&[a-zA-Z0-9#]+;/g, '') // Supprimer les entités HTML
      .trim();
  }

  /**
   * Mappe la difficulté basée sur le temps de préparation
   */
  private mapDifficulty(readyInMinutes: number): string {
    if (readyInMinutes <= 20) return 'Facile';
    if (readyInMinutes <= 45) return 'Intermédiaire';
    if (readyInMinutes <= 90) return 'Difficile';
    return 'Expert';
  }

  /**
   * Mappe le Nutri-Score basé sur le health score Spoonacular
   */
  private mapNutriScore(healthScore: number): string {
    if (healthScore >= 80) return 'A';
    if (healthScore >= 60) return 'B';
    if (healthScore >= 40) return 'C';
    if (healthScore >= 20) return 'D';
    return 'E';
  }

  /**
   * Mappe les unités Spoonacular vers les unités locales
   */
  private mapUnit(spoonacularUnit: string): Unit {
    const unitMap: Record<string, Unit> = {
      // Unités de masse
      g: Unit.G,
      gram: Unit.G,
      grams: Unit.G,
      kg: Unit.KG,
      kilogram: Unit.KG,
      kilograms: Unit.KG,
      oz: Unit.OZ,
      ounce: Unit.OZ,
      ounces: Unit.OZ,
      lb: Unit.LB,
      pound: Unit.LB,
      pounds: Unit.LB,

      // Unités de volume
      ml: Unit.ML,
      milliliter: Unit.ML,
      milliliters: Unit.ML,
      l: Unit.L,
      liter: Unit.L,
      liters: Unit.L,
      cup: Unit.CUP,
      cups: Unit.CUP,
      tsp: Unit.TSP,
      teaspoon: Unit.TSP,
      teaspoons: Unit.TSP,
      tbsp: Unit.TBSP,
      Tbs: Unit.TBSP,
      tablespoon: Unit.TBSP,
      tablespoons: Unit.TBSP,
      'fl-oz': Unit.FL_OZ,
      'fluid ounce': Unit.FL_OZ,
      'fluid ounces': Unit.FL_OZ,

      // Unités de pièce
      piece: Unit.PIECE,
      pieces: Unit.PIECE,
      unit: Unit.UNIT,
      units: Unit.UNIT,
      item: Unit.PIECE,
      items: Unit.PIECE,
      clove: Unit.PIECE,
      cloves: Unit.PIECE,
      slice: Unit.PIECE,
      slices: Unit.PIECE,
    };

    const normalizedUnit = spoonacularUnit.toLowerCase().trim();
    return unitMap[normalizedUnit] || Unit.PIECE;
  }

  /**
   * Sauvegarde le progrès dans un fichier JSON
   */
  private saveProgress(filePath: string, progress: SeedProgress): void {
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
  private loadProgress(filePath: string): SeedProgress | null {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const progress = JSON.parse(content) as SeedProgress;
        this.logger.log(
          `Progrès chargé depuis ${filePath}: offset ${progress.lastOffset}, ${progress.totalCreated} créées`,
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
    const targetFile = filePath || './spoonacular-seed-progress.json';
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
