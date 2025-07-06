import { SearchRequest } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { UnitConversionService } from 'src/common/units/unit-conversion.service';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import {
  RecipeSearchResult,
  RecipeSource,
  RecipeTemp,
  ScoredRecipe,
} from './interfaces/recipe-search.interface';
import { UserPreferences } from './interfaces/scoring-config.interface';

interface StockInfo {
  normalizedQuantity: number;
  baseUnit: string;
  dlc?: Date;
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly recipesIndex = 'recipes';

  constructor(
    private readonly client: NestElasticsearchService,
    private readonly unitConversionService: UnitConversionService,
  ) {}

  async onModuleInit() {
    await this.createRecipeIndex();
  }

  async createRecipeIndex() {
    const indexExists = await this.client.indices.exists({ index: 'recipes' });
    if (indexExists) {
      await this.client.indices.delete({ index: 'recipes' });
    }
    this.logger.log('Creating index recipes...');
    await this.client.indices.create({
      index: 'recipes',
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
              type: 'nested',
              properties: {
                id: { type: 'keyword' },
                name: { type: 'text', analyzer: 'french' },
                quantity: { type: 'double' },
                unit: { type: 'keyword' },
                productId: { type: 'keyword' },
                normalizedQuantity: { type: 'double' },
                baseUnit: { type: 'keyword' },
              },
            },
          },
        },
      },
    });
  }

  private _transformRecipeForIndex(recipe: Recipe): RecipeTemp {
    const { id, ingredients, ...restOfRecipe } = recipe;
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
          productId: ing.ingredient.products?.[0]?.id,
          normalizedQuantity,
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
    for (const stock of stocks) {
      if (stock.product.id && stock.unit) {
        const { value: normalizedQuantity, unit: baseUnit } =
          this.unitConversionService.normalize(stock.quantity, stock.unit);
        stocksMap[stock.product.id] = {
          normalizedQuantity,
          baseUnit,
          dlc: stock.dlc,
        };
      }
    }
    return stocksMap;
  }

  private createDlcMap(stocks: Stock[]) {
    const dlcMap: Record<string, string> = {};
    for (const stock of stocks) {
      if (stock.product.id && stock.dlc) {
        dlcMap[stock.product.id] = stock.dlc.toISOString();
      }
    }
    return dlcMap;
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
                match_all: {},
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
              minimum_should_match: 1,
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
                      long today = new Date().getTime();
                      int dlcCount = 0;
                      for (def ingredient : params._source.ingredients) {
                        if (ingredient.productId != null && params.dlc.containsKey(ingredient.productId)) {
                                                    long dlcDate = java.time.ZonedDateTime.parse(params.dlc[ingredient.productId]).toInstant().toEpochMilli();
                          long diff = dlcDate - today;
                          if (diff > 0) {
                            double days = diff / (1000.0 * 60 * 60 * 24);
                            dlcScore += 1.0 / (1.0 + days); 
                          } else {
                            dlcScore -= 1.0; 
                          }
                          dlcCount++;
                        }
                      }
                      return dlcCount > 0 ? dlcScore / dlcCount : 0;
                    `,
                  params: { dlc: dlcMap },
                },
              },
              weight: 5,
            },
            {
              filter: { match_all: {} },
              script_score: {
                script: {
                  source: `
                      double availabilityScore = 0;
                      if (params._source.ingredients == null || params._source.ingredients.isEmpty()) {
                        return 1.0; // No ingredients required, perfect availability
                      }
                      int totalIngredients = params._source.ingredients.size();
                      int availableIngredients = 0;
                      for (def ingredient : params._source.ingredients) {
                        if (ingredient.productId != null && params.stocks.containsKey(ingredient.productId)) {
                           def stock = params.stocks[ingredient.productId];
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
                      long today = new Date().getTime();
                      int dlcCount = 0;
                      for (def ingredient : params._source.ingredients) {
                        if (ingredient.productId != null && params.dlc.containsKey(ingredient.productId)) {
                          long dlcDate = ZonedDateTime.parse(params.dlc[ingredient.productId]).toInstant().toEpochMilli();
                          long diff = dlcDate - today;
                          if (diff > 0) {
                            double days = diff / (1000.0 * 60 * 60 * 24);
                            dlcScore += 1.0 / (1.0 + days); 
                          } else {
                            dlcScore -= 1.0; 
                          }
                          dlcCount++;
                        }
                      }
                      return dlcCount > 0 ? dlcScore / dlcCount : 0;
                    `,
                  params: { dlc: this.createDlcMap(stocks) },
                },
              },
              weight: 1.2,
            },
            {
              filter: { match_all: {} },
              script_score: {
                script: {
                  source: `
                      double availabilityScore = 0;
                      if (params._source.ingredients == null || params._source.ingredients.isEmpty()) {
                        return 1.0; // No ingredients required, perfect availability
                      }
                      int totalIngredients = params._source.ingredients.size();
                      int availableIngredients = 0;
                      for (def ingredient : params._source.ingredients) {
                        if (ingredient.productId != null && params.stocks.containsKey(ingredient.productId)) {
                           def stock = params.stocks[ingredient.productId];
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
}
