import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { UnitConversionService } from 'src/common/units/unit-conversion.service';
import { PieceUnit } from 'src/common/units/unit.enums';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { UserPreferences } from 'src/users/interfaces/user-preferences.interface';
import {
  RecipeSearchResult,
  RecipeSource,
  RecipeTemp,
  ScoredRecipe,
} from './interfaces/recipe-search.interface';

interface StockInfo {
  normalizedQuantity: number;
  baseUnit: string;
  dlc?: Date;
  ingredientId?: string; // ID de l'ingrédient lié au produit (pour matching hiérarchique)
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly recipesIndex: string;

  constructor(
    private readonly client: NestElasticsearchService,
    private readonly unitConversionService: UnitConversionService,
    private readonly configService: ConfigService,
  ) {
    this.recipesIndex = this.configService.get<string>(
      'ELASTICSEARCH_RECIPE_INDEX',
      'recipes',
    );
  }

  async onModuleInit() {
    await this.createRecipeIndex();
  }

  async createRecipeIndex() {
    const indexExists = await this.client.indices.exists({
      index: this.recipesIndex,
    });

    if (indexExists) {
      this.logger.log(`Index [${this.recipesIndex}] already exists.`);
      return;
    }

    try {
      this.logger.log(`Creating index [${this.recipesIndex}]...`);
      await this.client.indices.create({
        index: this.recipesIndex,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'french',
                fields: { keyword: { type: 'keyword', ignore_above: 256 } },
              },
              description: { type: 'text', analyzer: 'french' },
              categories: { type: 'text', analyzer: 'french' },
              ingredients_count: { type: 'integer' },
              ingredients: {
                type: 'object',
                properties: {
                  id: { type: 'keyword' },
                  name: { type: 'text', analyzer: 'french' },
                  quantity: { type: 'double' },
                  unit: { type: 'keyword' },
                  // productId: { type: 'keyword' },
                  normalizedQuantity: { type: 'double' },
                  baseUnit: { type: 'keyword' },
                },
              },
            },
          },
        },
      });
      this.logger.log(`Index [${this.recipesIndex}] created successfully.`);
    } catch (error) {
      this.logger.error(
        `Failed to create index [${this.recipesIndex}]:`,
        error,
      );
      throw error;
    }
  }

  private _transformRecipeForIndex(recipe: Recipe): RecipeTemp {
    const { id, ingredients, instructions, ...restOfRecipe } = recipe;
    return {
      ...restOfRecipe,
      id,
      ingredients_count: recipe.ingredients.length,
      ingredients: recipe.ingredients.map((ing) => {
        const { value: normalizedQuantity, unit: baseUnit } =
          this.unitConversionService.normalize(ing.quantity, ing.unit);

        return {
          id: ing.ingredient.id,
          name: ing.ingredient.name,
          quantity: ing.quantity,
          unit: ing.unit,
          // productId: ing.ingredient.products?.[0]?.id,
          normalizedQuantity,
          offTag: ing.ingredient.offTag,
          baseUnit,
        };
      }),
    };
  }

  async indexRecipe(recipe: Recipe) {
    this.logger.log(`Indexing recipe: ${recipe.name}`);
    const document = this._transformRecipeForIndex(recipe);
    return this.client.index({
      index: this.recipesIndex,
      id: recipe.id,
      document,
    });
  }

  async updateRecipeInIndex(recipe: Recipe) {
    this.logger.log(`Updating recipe in index: ${recipe.name}`);
    const document = this._transformRecipeForIndex(recipe);
    return this.client.update({
      index: this.recipesIndex,
      id: recipe.id,
      doc: document,
    });
  }

  async removeRecipeFromIndex(recipeId: string) {
    this.logger.log(`Removing recipe from index, id: ${recipeId}`);
    return this.client.delete({
      index: this.recipesIndex,
      id: recipeId,
    });
  }

  private createStocksMap(stocks: Stock[]) {
    const stocksMap: Record<string, StockInfo> = {};
    const now = new Date();

    for (const stock of stocks) {
      if (stock.product.id && stock.product.ingredients?.[0]?.id) {
        // Filtrer les produits périmés
        const dlcDate =
          typeof stock.dlc === 'string' ? new Date(stock.dlc) : stock.dlc;
        if (dlcDate <= now) {
          continue; // Ignorer les stocks périmés
        }

        // Utiliser la même logique de cascade que dans stock.service
        const effectiveUnit =
          stock.unit || stock.product.defaultUnit || PieceUnit.PIECE;

        const { value: normalizedQuantity, unit: baseUnit } =
          this.unitConversionService.normalize(stock.quantity, effectiveUnit);

        const ingredientId = stock.product.ingredients[0].id;

        // Créer une clé unique par ingrédient ET type d'unité de base
        const stockKey = `${ingredientId}_${baseUnit}`;

        // Si la clé existe déjà, additionner les quantités
        if (stocksMap[stockKey]) {
          stocksMap[stockKey].normalizedQuantity += normalizedQuantity;

          // Garder la DLC la plus proche pour l'anti-gaspillage
          const existingDlc =
            typeof stocksMap[stockKey].dlc === 'string'
              ? new Date(stocksMap[stockKey].dlc)
              : stocksMap[stockKey].dlc;

          if (existingDlc && dlcDate < existingDlc) {
            stocksMap[stockKey].dlc = stock.dlc;
          }
        } else {
          // Nouvelle entrée
          stocksMap[stockKey] = {
            normalizedQuantity,
            baseUnit,
            dlc: stock.dlc,
            ingredientId,
          };
        }
      }
    }
    return stocksMap;
  }

  private createDlcMap(stocks: Stock[]) {
    const dlcMap: Record<string, string> = {};
    const now = new Date();

    for (const stock of stocks) {
      if (stock.product.id && stock.dlc && stock.product.ingredients?.[0]?.id) {
        // Convertir stock.dlc en Date si c'est une string
        const dlcDate =
          typeof stock.dlc === 'string' ? new Date(stock.dlc) : stock.dlc;

        // Filtrer les produits périmés
        if (dlcDate <= now) {
          continue; // Ignorer les stocks périmés
        }

        // Utiliser la même logique de cascade que dans stock.service
        const effectiveUnit =
          stock.unit || stock.product.defaultUnit || PieceUnit.PIECE;

        const { unit: baseUnit } = this.unitConversionService.normalize(
          stock.quantity,
          effectiveUnit,
        );

        const ingredientId = stock.product.ingredients[0].id;

        // Créer une clé unique par ingrédient ET type d'unité de base
        const dlcKey = `${ingredientId}_${baseUnit}`;

        // Garder la DLC la plus proche pour l'anti-gaspillage
        if (dlcMap[dlcKey]) {
          const existingDlcDate = new Date(dlcMap[dlcKey]);
          if (dlcDate < existingDlcDate) {
            dlcMap[dlcKey] = dlcDate.toISOString();
          }
        } else {
          dlcMap[dlcKey] = dlcDate.toISOString();
        }
      }
    }
    return dlcMap;
  }

  async findMakeableRecipes(
    preferences: UserPreferences,
    stocks: Stock[],
  ): Promise<RecipeSearchResult> {
    this.logger.log(`findMakeableRecipes called with ${stocks.length} stocks`);

    // Si pas de stock, retourner des résultats vides
    if (stocks.length === 0) {
      this.logger.log('No stocks available');
      return {
        total: 0,
        results: [],
      };
    }

    const stocksMap = this.createStocksMap(stocks);
    const dlcMap = this.createDlcMap(stocks);

    const searchRequest: SearchRequest = {
      collapse: {
        field: 'name.keyword',
      },
      index: this.recipesIndex,
      query: {
        function_score: {
          query: {
            bool: {
              must: {
                bool: {
                  should: stocks
                    .filter((stock) => stock.product.ingredients?.[0]?.id)
                    .map((stock) => ({
                      term: {
                        'ingredients.id': stock.product.ingredients[0].id,
                      },
                    })),
                  minimum_should_match: 1,
                },
              },
              should: (preferences.preferredCategories || []).map(
                (category) => ({
                  match: {
                    categories: {
                      query: category,
                      boost: 2,
                    },
                  },
                }),
              ),
              minimum_should_match: 0,
            },
          },
          functions: [
            // 1. FILTRE STRICT : Availability score (0.0 ou 10.0 seulement)
            {
              filter: { match_all: {} },
              script_score: {
                script: {
                  source: `
                    if (params._source == null || params._source.ingredients == null) {
                      return 10.0; // No ingredients required, perfect availability
                    }
                    int totalIngredients = params._source.ingredients.size();
                    int availableIngredients = 0;
                    for (int i = 0; i < params._source.ingredients.size(); i++) {
                      def ingredient = params._source.ingredients.get(i);
                      boolean ingredientAvailable = false;

                      if (ingredient.id != null) {
                        // Chercher toutes les variantes d'unités pour cet ingrédient
                        def unitVariants = ["g", "ml", "piece"];
                        for (def unit : unitVariants) {
                          String stockKey = ingredient.id + "_" + unit;
                          if (params.stocks.containsKey(stockKey)) {
                            def stock = params.stocks[stockKey];
                            if (stock.baseUnit == ingredient.baseUnit && stock.normalizedQuantity >= ingredient.normalizedQuantity) {
                              ingredientAvailable = true;
                              break; // Une variante suffit
                            }
                          }
                        }
                      }

                      if (ingredientAvailable) {
                        availableIngredients++;
                      }
                    }
                    if (totalIngredients > 0) {
                      // Score binaire : 100 pour 100% makeable, 0 sinon
                      if (availableIngredients == totalIngredients) {
                        return 100.0;
                      } else {
                        return 0.0;
                      }
                    }
                    return 100.0;
                  `,
                  params: { stocks: stocksMap },
                },
              },
              weight: 2,
            },
            // 2. RANKING ANTI-GASPILLAGE : Score DLC pour prioriser les produits qui périment
            this._buildDlcScoreFunction(dlcMap),
          ],
          score_mode: 'sum',
          boost_mode: 'replace',
          min_score: 100.0, // Seulement les recettes 100% makeables
        },
      },
      sort: [{ _score: { order: 'desc' } }],
      size: 5,
    };

    try {
      console.log(
        `Querying Elasticsearch for findMakeableRecipes: ${JSON.stringify(
          searchRequest,
          null,
          2,
        )}`,
      );
      const result = await this.client.search<RecipeSource>(searchRequest);

      // Les recettes sont déjà filtrées par la query script, pas besoin de filtrer ici
      const recipes: ScoredRecipe[] = result.hits.hits
        .filter((hit) => hit._id && hit._source && hit._score)
        .map((hit) => ({
          ...(hit._source as RecipeTemp),
          id: hit._id!,
          score: hit._score || 0,
        }));

      return {
        total: recipes.length,
        results: recipes,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Erreur lors de la recherche des recettes réalisables:',
        errorMessage,
      );
      this.logger.error(
        'Search request was:',
        JSON.stringify(searchRequest, null, 2),
      );
      // En cas d'erreur, retourner une liste vide plutôt que de planter
      return {
        total: 0,
        results: [],
      };
    }
  }

  async discoverRecipes(
    preferences: UserPreferences,
    stocks: Stock[],
  ): Promise<RecipeSearchResult> {
    const stocksMap = this.createStocksMap(stocks);
    const dlcMap = this.createDlcMap(stocks);

    const searchRequest: SearchRequest = {
      collapse: {
        field: 'name.keyword',
      },
      index: this.recipesIndex,
      query: {
        function_score: {
          query: {
            bool: {
              must: {
                bool: {
                  should: stocks
                    .filter((stock) => stock.product.ingredients?.[0]?.id)
                    .map((stock) => ({
                      term: {
                        'ingredients.id': stock.product.ingredients[0].id,
                      },
                    })),
                  minimum_should_match: 1,
                },
              },
              should: (preferences.preferredCategories || []).map(
                (category) => ({
                  match: {
                    categories: {
                      query: category,
                      boost: 2,
                    },
                  },
                }),
              ),
              minimum_should_match: 0,
            },
          },
          functions: [
            this._buildDlcScoreFunction(dlcMap),
            this._buildAvailabilityScoreFunction(stocksMap),
          ],
          score_mode: 'sum',
          boost_mode: 'multiply',
        },
      },
    };

    this.logger.debug(
      `Querying Elasticsearch for discovery: ${JSON.stringify(
        searchRequest,
        null,
        2,
      )}`,
    );

    const result = await this.client.search<RecipeSource>(searchRequest);

    const recipes: ScoredRecipe[] = result.hits.hits
      .filter((hit) => hit._id && hit._source)
      .map((hit) => ({
        ...(hit._source as RecipeTemp),
        id: hit._id!,
        score: hit._score || 0,
      }));

    return {
      total:
        typeof result.hits.total === 'number'
          ? result.hits.total
          : (result.hits.total?.value ?? 0),
      results: recipes,
    };
  }

  async searchRecipes(
    query: string,
    preferences: UserPreferences,
    stocks: Stock[],
  ): Promise<RecipeSearchResult> {
    const stocksMap = this.createStocksMap(stocks);

    const searchRequest: SearchRequest = {
      collapse: {
        field: 'name.keyword',
      },
      index: this.recipesIndex,
      query: {
        function_score: {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query,
                    fields: ['name^3', 'description', 'ingredients.name^2'],
                    fuzziness: 'AUTO',
                  },
                },
              ],
              should: (preferences.preferredCategories || []).map(
                (category) => ({
                  match: {
                    categories: {
                      query: category,
                      boost: 2,
                    },
                  },
                }),
              ),
              minimum_should_match:
                (preferences.preferredCategories || []).length > 0 ? 1 : 0,
              must_not: [
                {
                  match: {
                    'ingredients.name': {
                      query: (preferences.allergenes || []).join(' '),
                    },
                  },
                },
              ],
            },
          },
          functions: [
            {
              filter: { match_all: {} },
              script_score: {
                script: {
                  source: `
                      double dlcScore = 0;
                      if (params.dlc == null || params.dlc.isEmpty()) {
                        return 0;
                      }
                      if (params._source == null || params._source.ingredients == null) {
                        return 0;
                      }
                      long today = new Date().getTime();
                      int dlcCount = 0;
                      for (int i = 0; i < params._source.ingredients.size(); i++) {
                        def ingredient = params._source.ingredients.get(i);
                        if (ingredient.id != null && params.dlc.containsKey(ingredient.id)) {
                          long dlcDate = ZonedDateTime.parse(params.dlc[ingredient.id]).toInstant().toEpochMilli();
                          long diff = dlcDate - today;
                          if (diff > 0) {
                            double days = diff / (1000.0 * 60 * 60 * 24);
                            dlcScore += 1.0 / (1.0 + days);
                          }
                          // Ne pas pénaliser les produits expirés car ils sont déjà filtrés
                          dlcCount++;
                        }
                      }
                      return dlcCount > 0 ? dlcScore / dlcCount : 0;
                    `,
                  params: { dlc: this.createDlcMap(stocks) },
                },
              },
              weight: 2,
            },
            {
              filter: { match_all: {} },
              script_score: {
                script: {
                  source: `
                      double availabilityScore = 0;
                      if (params._source == null || params._source.ingredients == null) {
                        return 1.0; // No ingredients required, perfect availability
                      }
                      int totalIngredients = params._source.ingredients.size();
                      int availableIngredients = 0;
                      for (int i = 0; i < params._source.ingredients.size(); i++) {
                        def ingredient = params._source.ingredients.get(i);
                        if (ingredient.id != null && params.stocks.containsKey(ingredient.id)) {
                           def stock = params.stocks[ingredient.id];
                           if (stock.baseUnit == ingredient.baseUnit && stock.normalizedQuantity >= ingredient.normalizedQuantity) {
                             availableIngredients++;
                           }
                        }
                      }
                      if (totalIngredients > 0) {
                        availabilityScore = (float)availableIngredients / totalIngredients;
                      }
                      return availabilityScore;
                    `,
                  params: { stocks: stocksMap },
                },
              },
              weight: 1.5,
            },
          ],
          score_mode: 'sum',
          boost_mode: 'multiply',
        },
      },
    };
    this.logger.debug(
      `Querying Elasticsearch for search: ${JSON.stringify(
        searchRequest,
        null,
        2,
      )}`,
    );

    const result = await this.client.search<RecipeSource>(searchRequest);

    const recipes: ScoredRecipe[] = result.hits.hits
      .filter((hit) => hit._id && hit._source)
      .map((hit) => ({
        ...(hit._source as RecipeTemp),
        id: hit._id!,
        score: hit._score || 0,
      }));

    return {
      total:
        typeof result.hits.total === 'number'
          ? result.hits.total
          : (result.hits.total?.value ?? 0),
      results: recipes,
    };
  }

  private _buildDlcScoreFunction(dlcMap: Record<string, string>) {
    return {
      filter: { match_all: {} },
      script_score: {
        script: {
          source: `
            double dlcScore = 0;
            if (params.dlc == null || params.dlc.isEmpty()) { return 0; }
            if (params._source == null || params._source.ingredients == null) { return 0; }
            long today = new Date().getTime();
            int dlcCount = 0;
            for (int i = 0; i < params._source.ingredients.size(); i++) {
              def ingredient = params._source.ingredients.get(i);
              double bestDlcScore = 0.0;
              boolean ingredientFound = false;

              if (ingredient.id != null) {
                // Chercher toutes les variantes d'unités pour cet ingrédient
                def unitVariants = ["g", "ml", "piece"];
                for (def unit : unitVariants) {
                  String dlcKey = ingredient.id + "_" + unit;
                  if (params.dlc.containsKey(dlcKey)) {
                    long dlcDate = java.time.ZonedDateTime.parse(params.dlc[dlcKey]).toInstant().toEpochMilli();
                    long diff = dlcDate - today;
                    if (diff > 0) {
                      double days = diff / (1000.0 * 60 * 60 * 24);
                      double currentScore = 1.0 / (1.0 + days);
                      bestDlcScore = Math.max(bestDlcScore, currentScore);
                      ingredientFound = true;
                    }
                  }
                }
              }

              if (ingredientFound) {
                dlcScore += bestDlcScore;
                dlcCount++;
              }
            }
            // Somme avec bonus logarithmique pour favoriser les recettes multi-ingrédients
            double finalScore = dlcCount > 0 ? dlcScore * (1 + Math.log(1 + dlcCount)) : 0;
            return Math.max(0.0, finalScore); // Garantir un score non-négatif
          `,
          params: { dlc: dlcMap },
        },
      },
      weight: 5,
    };
  }

  /**
   * Génère la fonction de scoring pour la disponibilité des ingrédients.
   *
   * LOGIQUE AMÉLIORÉE (anti-sur-comptage) :
   * - Chaque recette demande des ingrédients spécifiques (ex: "eau minérale")
   * - Chaque produit est lié à un seul ingrédient générique (ex: "eau")
   * - Le système vérifie si l'ingrédient générique peut satisfaire l'ingrédient spécifique
   * - Un produit ne compte qu'une seule fois par ingrédient de recette
   *
   * @param stocksMap Mapping produit -> informations de stock
   */
  private _buildAvailabilityScoreFunction(
    stocksMap: Record<string, StockInfo>,
  ) {
    // Construire un mapping ingredient -> liste des produits disponibles
    // Ceci permet de gérer le matching hiérarchique : si une recette demande "eau minérale"
    // mais que l'utilisateur a un produit lié à "eau", on peut quand même le matcher
    const ingredientToProducts: Record<string, string[]> = {};

    for (const [productId, stockInfo] of Object.entries(stocksMap)) {
      if (stockInfo.ingredientId) {
        if (!ingredientToProducts[stockInfo.ingredientId]) {
          ingredientToProducts[stockInfo.ingredientId] = [];
        }
        ingredientToProducts[stockInfo.ingredientId].push(productId);
      }
    }

    return {
      filter: { match_all: {} },
      script_score: {
        script: {
          source: `
            double availabilityScore = 0;
            if (params._source == null || params._source.ingredients == null) {
              return 1.0; // No ingredients required, perfect availability
            }
            int totalIngredients = params._source.ingredients.size();
            int availableIngredients = 0;
            
            for (int i = 0; i < params._source.ingredients.size(); i++) {
              def ingredient = params._source.ingredients.get(i);
              boolean ingredientAvailable = false;
              
              // AMÉLIORATION: Vérifier tous les produits liés à cet ingrédient
              // au lieu de juste le productId spécifique de la recette
              if (ingredient.id != null && params.ingredientToProducts.containsKey(ingredient.id)) {
                def availableProductsForIngredient = params.ingredientToProducts[ingredient.id];
                
                for (int j = 0; j < availableProductsForIngredient.size(); j++) {
                  def productId = availableProductsForIngredient.get(j);
                  if (params.stocks.containsKey(productId)) {
                    def stock = params.stocks[productId];
                    if (stock.baseUnit == ingredient.baseUnit && stock.normalizedQuantity >= ingredient.normalizedQuantity) {
                      ingredientAvailable = true;
                      break; // Un produit suffit pour cet ingrédient
                    }
                  }
                }
              }
              
              // FALLBACK: Chercher toutes les variantes d'unités pour compatibilité
              if (!ingredientAvailable && ingredient.id != null) {
                def unitVariants = ["g", "ml", "piece"];
                for (def unit : unitVariants) {
                  String stockKey = ingredient.id + "_" + unit;
                  if (params.stocks.containsKey(stockKey)) {
                    def stock = params.stocks[stockKey];
                    if (stock.baseUnit == ingredient.baseUnit && stock.normalizedQuantity >= ingredient.normalizedQuantity) {
                      ingredientAvailable = true;
                      break; // Une variante suffit
                    }
                  }
                }
              }
              
              if (ingredientAvailable) {
                availableIngredients++;
              }
            }
            
            if (totalIngredients > 0) {
              availabilityScore = (float)availableIngredients / totalIngredients;
            }
            return availabilityScore;
          `,
          params: {
            stocks: stocksMap,
            ingredientToProducts: ingredientToProducts,
          },
        },
      },
      weight: 1.5,
    };
  }

  async countRecipes(): Promise<number> {
    try {
      const result = await this.client.count({
        index: this.recipesIndex,
      });
      return result.count;
    } catch (error) {
      this.logger.error('Error counting recipes in Elasticsearch:', error);
      return 0;
    }
  }
}
