/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FilterOperator,
  PaginateQuery,
  Paginated,
  paginate,
} from 'nestjs-paginate';
import { UnitConversionService } from 'src/common/units/unit-conversion.service';
import { StockLog, StockLogAction } from 'src/stocks/entities/stock-log.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { Repository } from 'typeorm';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { ValidateRecipeDto } from './dto/validate-recipe.dto';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';
import RecipeEventName from './events/recipe.events.name';
import {
  RecipeValidationResult,
  StockSelection,
  StockUsage,
} from './interfaces/recipe-validation-result.interface';

@Injectable()
export class RecipeService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockLog)
    private readonly stockLogRepository: Repository<StockLog>,
    private readonly unitConversionService: UnitConversionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    const { ingredients: ingredientsDto, ...recipeData } = createRecipeDto;

    const recipe = this.recipeRepository.create(recipeData);
    const savedRecipe = await this.recipeRepository.save(recipe);

    if (ingredientsDto && ingredientsDto.length > 0) {
      const recipeIngredients = ingredientsDto.map((ingredientDto) => {
        return this.recipeIngredientRepository.create({
          ...ingredientDto, // Contient ingredientId, quantity, unit, etc.
          recipeId: savedRecipe.id,
        });
      });
      await this.recipeIngredientRepository.save(recipeIngredients);
    }

    const recipeWithRelations = await this.recipeRepository.findOne({
      where: { id: savedRecipe.id },
      relations: [
        'ingredients',
        'ingredients.ingredient',
        'ingredients.ingredient.products',
      ],
    });

    if (!recipeWithRelations) {
      throw new NotFoundException(
        `Recipe with ID ${savedRecipe.id} not found after creation`,
      );
    }

    this.eventEmitter.emit(RecipeEventName.RecipeCreated, recipeWithRelations);

    return recipeWithRelations;
  }

  async findAll(query: PaginateQuery, user?: User): Promise<Paginated<Recipe>> {
    const queryBuilder = this.recipeRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.ingredients', 'recipeIngredient')
      .leftJoinAndSelect('recipeIngredient.ingredient', 'ingredient');

    if (user?.stocks && user.stocks.length > 0) {
      const userProductIds = user.stocks.map((stock) => stock.product.id);

      // Sous-requête pour trouver les recettes dont TOUS les ingrédients sont dans le stock de l'utilisateur
      queryBuilder.andWhere(
        (qb) => {
          const subQuery = qb
            .subQuery()
            .select('r.id')
            .from(Recipe, 'r')
            .leftJoin('r.ingredients', 'ri')
            .leftJoin('ri.ingredient', 'ing')
            .leftJoin('ing.products', 'p')
            .where('p.id IS NOT NULL') // S'assurer qu'il y a un produit associé
            .groupBy('r.id')
            .having(
              'COUNT(DISTINCT ing.id) = SUM(CASE WHEN p.id IN (:...userProductIds) THEN 1 ELSE 0 END)',
            )
            .getQuery();
          return 'recipe.id IN ' + subQuery;
        },
        { userProductIds },
      );
    }

    return paginate(query, queryBuilder, {
      sortableColumns: [
        'id',
        'name',
        'createdAt',
        'updatedAt',
        'difficulty',
        'cookingTime',
      ],
      searchableColumns: ['name', 'description', 'categories'],
      defaultSortBy: [['createdAt', 'DESC']],
      filterableColumns: {
        categories: [FilterOperator.IN],
        difficulty: [FilterOperator.EQ, FilterOperator.LTE, FilterOperator.GTE],
        cookingTime: [
          FilterOperator.LT,
          FilterOperator.GT,
          FilterOperator.LTE,
          FilterOperator.GTE,
        ],
      },
    });
  }

  async findOne(id: string): Promise<Recipe> {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['ingredients', 'ingredients.ingredient'],
    });

    if (!recipe) {
      throw new NotFoundException(`Recette avec l'ID ${id} non trouvée`);
    }

    return recipe;
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto): Promise<Recipe> {
    const existingRecipe = await this.findOne(id);

    // Vérifier que la recette n'est pas une recette externe (Spoonacular, etc.)
    if (
      existingRecipe.externalSource &&
      existingRecipe.externalSource !== 'manual'
    ) {
      throw new BadRequestException(
        `Impossible de modifier une recette externe (source: ${existingRecipe.externalSource})`,
      );
    }

    const { ingredients: ingredientsDto, ...recipeData } = updateRecipeDto;

    this.recipeRepository.merge(existingRecipe, recipeData);

    if (ingredientsDto) {
      await this.recipeIngredientRepository.delete({ recipeId: id });

      const newRecipeIngredients = ingredientsDto.map((ingredientDto) => {
        return this.recipeIngredientRepository.create({
          ...ingredientDto,
          recipeId: id,
        });
      });

      await this.recipeIngredientRepository.save(newRecipeIngredients);
    }

    await this.recipeRepository.save(existingRecipe);

    const updatedRecipeWithRelations = await this.recipeRepository.findOne({
      where: { id: id },
      relations: ['ingredients', 'ingredients.ingredient'],
    });

    if (!updatedRecipeWithRelations) {
      throw new NotFoundException(
        `Recipe with ID ${id} not found after update`,
      );
    }

    this.eventEmitter.emit(
      RecipeEventName.RecipeUpdated,
      updatedRecipeWithRelations,
    );

    return updatedRecipeWithRelations;
  }

  async remove(id: string): Promise<void> {
    const recipe = await this.findOne(id);

    // Vérifier que la recette n'est pas une recette externe (Spoonacular, etc.)
    if (recipe.externalSource && recipe.externalSource !== 'manual') {
      throw new BadRequestException(
        `Impossible de supprimer une recette externe (source: ${recipe.externalSource})`,
      );
    }

    await this.recipeRepository.remove(recipe);
    this.eventEmitter.emit(RecipeEventName.RecipeDeleted, recipe);
  }

  async validateRecipe(
    recipeId: string,
    validateRecipeDto: ValidateRecipeDto,
    user: User,
  ): Promise<RecipeValidationResult> {
    // 1. Récupérer la recette avec ses ingrédients
    const recipe = await this.recipeRepository.findOne({
      where: { id: recipeId },
      relations: ['ingredients', 'ingredients.ingredient'],
    });

    if (!recipe) {
      throw new NotFoundException(`Recette avec l'ID ${recipeId} non trouvée`);
    }

    // 2. Calculer le ratio d'ajustement
    const scalingRatio = validateRecipeDto.servings / recipe.servings;

    // 3. Récupérer le stock de l'utilisateur
    const userStocks = await this.stockRepository.find({
      where: { user: { id: user.id } },
      relations: ['product', 'product.ingredients'],
    });

    const result: RecipeValidationResult = {
      success: false,
      message: '',
      recipe: {
        id: recipe.id,
        name: recipe.name,
        originalServings: recipe.servings,
        requestedServings: validateRecipeDto.servings,
        scalingRatio,
      },
      ingredientsUsed: [],
      stockUpdates: [],
      missingIngredients: [],
    };

    // 4. Vérifier la disponibilité et calculer les quantités ajustées avec conversion d'unités
    const stockUpdatesMap = new Map<string, any>();

    for (const recipeIngredient of recipe.ingredients) {
      const adjustedQuantity = recipeIngredient.quantity * scalingRatio;

      // Chercher TOUS les stocks correspondants
      const matchingStocks = userStocks.filter((stock) => {
        // Correspondance par ingrédients associés au produit
        if (stock.product.ingredients && stock.product.ingredients.length > 0) {
          return stock.product.ingredients.some(
            (ingredient) => ingredient.id === recipeIngredient.ingredientId,
          );
        }

        return false;
      });

      // Calculer les stocks nécessaires avec conversion d'unités et priorité FIFO (DLC)
      const stockSelection = this.selectStocksForQuantityWithUnits(
        matchingStocks,
        adjustedQuantity,
        recipeIngredient.unit,
      );

      if (!stockSelection.success) {
        // Calculer la quantité totale disponible en convertissant vers l'unité de la recette
        const totalAvailable = matchingStocks.reduce((sum, stock) => {
          const stockUnit = stock.unit || stock.product.defaultUnit;
          if (!stockUnit) return sum;
          const stockResult = this.unitConversionService.calculateTotalQuantity(
            stock.quantity,
            stockUnit,
            stock.product.unitSize,
            stock.product.packagingSize,
          );

          const converted = this.unitConversionService.convert(
            stockResult.totalQuantity,
            stockResult.baseUnit,
            recipeIngredient.unit,
          );

          return sum + (converted || 0);
        }, 0);

        result.missingIngredients?.push({
          ingredientId: recipeIngredient.ingredientId,
          ingredientName: recipeIngredient.ingredient.name,
          requiredQuantity: adjustedQuantity,
          availableQuantity: totalAvailable,
          unit: recipeIngredient.unit,
          shortage: adjustedQuantity - totalAvailable,
        });
        continue;
      }

      // Traiter chaque stock sélectionné
      let totalQuantityFromStocks = 0;
      for (const stockUsage of stockSelection.stockUsages) {
        const stock = stockUsage.stock;
        const quantityToUse = stockUsage.quantityToUse; // Déjà en unité du stock

        totalQuantityFromStocks += quantityToUse;

        // Calculer les quantités avant/après en tenant compte du packaging
        const stockUnit = stock.unit || stock.product.defaultUnit;
        if (!stockUnit) continue;

        const stockResult = this.unitConversionService.calculateTotalQuantity(
          stock.quantity,
          stockUnit,
          stock.product.unitSize,
          stock.product.packagingSize,
        );

        const quantityBefore = stockResult.totalQuantity;
        const quantityAfter = quantityBefore - quantityToUse;

        // Préparer les mises à jour de stock
        stockUpdatesMap.set(stock.id, {
          stockId: stock.id,
          productName: stock.product.name,
          quantityBefore,
          quantityAfter,
          quantityUsed: quantityToUse,
          unit: stock.unit, // Utiliser l'unité du stock pour la mise à jour
          stock: stock,
          // Calculer la nouvelle quantité base pour la DB
          // Extract nested ternary into an independent statement
          newBaseQuantity: (() => {
            if (stock.product.packagingSize && stock.product.unitSize) {
              return (
                quantityAfter /
                (stock.product.packagingSize * stock.product.unitSize)
              );
            } else if (stock.product.unitSize) {
              return quantityAfter / stock.product.unitSize;
            } else {
              return quantityAfter;
            }
          })(),
        });
      }

      // Ajouter à la liste des ingrédients utilisés (agrégé)
      result.ingredientsUsed.push({
        ingredientId: recipeIngredient.ingredientId,
        ingredientName: recipeIngredient.ingredient.name,
        originalQuantity: recipeIngredient.quantity,
        adjustedQuantity,
        unit: recipeIngredient.unit,
        stockId:
          stockSelection.stockUsages.length === 1
            ? stockSelection.stockUsages[0].stock.id
            : undefined,
        stockQuantityBefore: stockSelection.stockUsages.reduce(
          (sum: number, usage: StockUsage) => {
            const stockUnit =
              usage.stock.unit || usage.stock.product.defaultUnit;
            if (!stockUnit) return sum;

            const stockResult =
              this.unitConversionService.calculateTotalQuantity(
                usage.stock.quantity,
                stockUnit,
                usage.stock.product.unitSize,
                usage.stock.product.packagingSize,
              );
            return sum + stockResult.totalQuantity;
          },
          0,
        ),
        stockQuantityAfter: stockSelection.stockUsages.reduce(
          (sum: number, usage: StockUsage) => {
            const stockUnit =
              usage.stock.unit || usage.stock.product.defaultUnit;
            if (!stockUnit) return sum;

            const stockResult =
              this.unitConversionService.calculateTotalQuantity(
                usage.stock.quantity,
                stockUnit,
                usage.stock.product.unitSize,
                usage.stock.product.packagingSize,
              );
            return sum + (stockResult.totalQuantity - usage.quantityToUse);
          },
          0,
        ),
      });
    }

    // 5. Déterminer le résultat
    if (result.missingIngredients && result.missingIngredients.length > 0) {
      result.success = false;
      result.message = `Impossible de préparer la recette : ${result.missingIngredients.length} ingrédient(s) manquant(s)`;
      return result;
    }

    // 6. Effectuer les mises à jour de stock si tout est OK
    try {
      const stockUpdates = Array.from(stockUpdatesMap.values());

      for (const update of stockUpdates) {
        const stock = update.stock;
        // Utiliser totalQuantity si disponible, sinon quantity
        const effectiveQuantity = stock.totalQuantity || stock.quantity;
        const quantityBefore = effectiveQuantity;
        const quantityAfter = quantityBefore - update.quantityUsed;

        // Mettre à jour le stock
        const updateData: any = {
          quantity: quantityAfter,
        };

        // Si totalQuantity existe, la mettre à jour aussi
        if (stock.totalQuantity !== undefined && stock.totalQuantity !== null) {
          updateData.totalQuantity = quantityAfter;
        }

        await this.stockRepository.update(stock.id, updateData);

        // Créer le log
        const stockLog = this.stockLogRepository.create({
          stock: { id: stock.id },
          user: { id: user.id },
          action: StockLogAction.CONSUME,
          quantityBefore,
          quantityAfter,
          quantityUsed: update.quantityUsed,
          reason: `Recette: ${recipe.name} (${validateRecipeDto.servings} portions)`,
          metadata: {
            recipeId: recipe.id,
            recipeName: recipe.name,
            originalServings: recipe.servings,
            requestedServings: validateRecipeDto.servings,
            scalingRatio,
            notes: validateRecipeDto.notes,
          },
        });

        await this.stockLogRepository.save(stockLog);

        // Ajouter aux résultats
        result.stockUpdates.push({
          stockId: stock.id,
          productName: stock.product.name,
          quantityBefore,
          quantityAfter,
          quantityUsed: update.quantityUsed,
          unit: update.unit,
        });
      }

      result.success = true;
      result.message = `Recette "${recipe.name}" préparée avec succès pour ${validateRecipeDto.servings} personne(s). ${stockUpdates.length} produit(s) consommé(s).`;
    } catch (error) {
      throw new BadRequestException(
        'Erreur lors de la mise à jour du stock: ' + error.message,
      );
    }

    return result;
  }

  private selectBestStock(
    stocks: Stock[],
    requiredQuantity: number,
  ): Stock | null {
    if (!stocks || stocks.length === 0) {
      return null;
    }

    const validStocks = stocks.filter(
      (stock) => (stock.totalQuantity || stock.quantity) >= requiredQuantity,
    );

    if (validStocks.length === 0) {
      return null;
    }

    if (validStocks.length === 1) {
      return validStocks[0];
    }

    return validStocks.toSorted((a, b) => {
      const dlcA = new Date(a.dlc).getTime();
      const dlcB = new Date(b.dlc).getTime();

      if (dlcA !== dlcB) {
        return dlcA - dlcB;
      }

      const quantityA = a.totalQuantity || a.quantity;
      const quantityB = b.totalQuantity || b.quantity;
      const diffA = Math.abs(quantityA - requiredQuantity);
      const diffB = Math.abs(quantityB - requiredQuantity);

      if (diffA !== diffB) {
        return diffA - diffB;
      }

      const createdA = new Date(a.createdAt).getTime();
      const createdB = new Date(b.createdAt).getTime();

      return createdA - createdB;
    })[0];
  }

  private selectStocksForQuantityWithUnits(
    stocks: Stock[],
    requiredQuantity: number,
    requiredUnit: any,
  ): StockSelection {
    if (!stocks || stocks.length === 0) {
      return { success: false, stockUsages: [], totalQuantity: 0 };
    }

    const now = new Date();
    const stocksWithAvailableQuantity = stocks
      .filter((stock) => {
        // Filtrer les stocks périmés
        const dlcDate =
          typeof stock.dlc === 'string' ? new Date(stock.dlc) : stock.dlc;
        return dlcDate > now;
      })
      .map((stock) => {
        const stockUnit = stock.unit || stock.product.defaultUnit;
        if (!stockUnit) return null;

        const stockResult = this.unitConversionService.calculateTotalQuantity(
          stock.quantity,
          stockUnit,
          stock.product.unitSize,
          stock.product.packagingSize,
        );

        const convertedQuantity = this.unitConversionService.convert(
          stockResult.totalQuantity,
          stockResult.baseUnit,
          requiredUnit,
        );

        if (convertedQuantity === null) return null;

        return {
          stock,
          stockUnit,
          totalStockQuantity: stockResult.totalQuantity,
          availableInRecipeUnit: convertedQuantity,
        };
      })
      .filter(
        (item): item is NonNullable<typeof item> =>
          item !== null && item.availableInRecipeUnit > 0,
      )
      .sort((a, b) => {
        // Priorité 1: FIFO - DLC la plus proche en premier (anti-gaspillage)
        const dlcA = new Date(a.stock.dlc).getTime();
        const dlcB = new Date(b.stock.dlc).getTime();
        if (dlcA !== dlcB) return dlcA - dlcB;

        // Priorité 2: Plus ancien stock (FIFO sur la création)
        const createdA = new Date(a.stock.createdAt).getTime();
        const createdB = new Date(b.stock.createdAt).getTime();
        return createdA - createdB;
      });

    // Vérifier si on a assez de stock total
    const totalAvailable = stocksWithAvailableQuantity.reduce(
      (sum, item) => sum + item.availableInRecipeUnit,
      0,
    );

    if (totalAvailable < requiredQuantity) {
      return { success: false, stockUsages: [], totalQuantity: 0 };
    }

    // Sélection optimale : prendre les stocks dans l'ordre FIFO
    const stockUsages: StockUsage[] = [];
    let remainingQuantity = requiredQuantity;

    for (const item of stocksWithAvailableQuantity) {
      if (remainingQuantity <= 0) break;

      const quantityToUseInRecipeUnit = Math.min(
        item.availableInRecipeUnit,
        remainingQuantity,
      );

      // Convertir la quantité à utiliser vers l'unité du stock pour la soustraction
      const quantityToUseInStockUnit = this.unitConversionService.convert(
        quantityToUseInRecipeUnit,
        requiredUnit,
        item.stockUnit,
      );

      if (quantityToUseInStockUnit === null) continue;

      // Utiliser directement la quantité réelle du stock (pas convertie)
      const actualQuantityToUse = Math.min(
        quantityToUseInStockUnit,
        item.totalStockQuantity,
      );

      stockUsages.push({
        stock: item.stock,
        quantityToUse: actualQuantityToUse, // En unité du stock
      });

      remainingQuantity -= quantityToUseInRecipeUnit;
    }

    return {
      success: remainingQuantity <= 0.001, // Tolérance pour les erreurs d'arrondi
      stockUsages,
      totalQuantity: requiredQuantity - remainingQuantity,
    };
  }
}
