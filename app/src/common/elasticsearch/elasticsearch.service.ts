import { QueryDslQueryContainer } from '@elastic/elasticsearch/lib/api/types';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService as NestElasticsearchService } from '@nestjs/elasticsearch';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import {
  RecipeSearchResult,
  RecipeSource,
  RecipeTemp,
  ScoredRecipe,
} from './interfaces/recipe-search.interface';
import { UserPreferences } from './interfaces/scoring-config.interface';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private readonly recipesIndex = 'recipes';

  constructor(private readonly client: NestElasticsearchService) {}

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
                productId: { type: 'keyword' },
                name: { type: 'text', analyzer: 'french' },
                quantity: { type: 'float' },
                unit: { type: 'keyword' },
              },
            },
          },
        },
      },
    });
  }

  async indexRecipe(recipe: Recipe): Promise<any> {
    this.logger.log(
      `[indexRecipe] Indexing recipe with name: "${recipe.name}"`,
    );
    const recipeDocument = {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      categories: recipe.categories,
      ingredients: recipe.ingredients.map((recipeIngredient) => ({
        productId: recipeIngredient.ingredient.products[0]?.id,
        name: recipeIngredient.ingredient.name,
        quantity: recipeIngredient.quantity,
        unit: recipeIngredient.unit,
      })),
      ingredients_count: recipe.ingredients.filter(
        (recipeIngredient) =>
          recipeIngredient.ingredient.products &&
          recipeIngredient.ingredient.products.length > 0,
      ).length,
    };

    this.logger.debug(
      `Indexing document: ${JSON.stringify(recipeDocument, null, 2)}`,
    );
    return this.client.index({
      index: this.recipesIndex,
      id: recipe.id,
      body: recipeDocument,
    });
  }

  async updateRecipeInIndex(recipe: Recipe) {
    this.logger.log(`Mise à jour de la recette ${recipe.id} dans l'index.`);
    return this.indexRecipe(recipe);
  }

  async removeRecipeFromIndex(recipeId: string) {
    this.logger.log(`Suppression de la recette ${recipeId} de l'index.`);
    return this.client.delete({
      index: this.recipesIndex,
      id: recipeId,
    });
  }

  async searchRecipes(
    query: string,
    userStocks: Stock[],
    userPreferences: UserPreferences,
  ): Promise<RecipeSearchResult> {
    const must_clauses: QueryDslQueryContainer[] = [];
    if (query) {
      must_clauses.push({
        match: {
          name: {
            query: query,
            fuzziness: 'AUTO',
          },
        },
      });
    }

    const filter_clauses: QueryDslQueryContainer[] = [];
    if (userStocks && userStocks.length > 0) {
      filter_clauses.push({
        nested: {
          path: 'ingredients',
          query: {
            bool: {
              must: [
                {
                  terms: {
                    'ingredients.productId': userStocks.map(
                      (stock) => stock.product.id,
                    ),
                  },
                },
              ],
            },
          },
        },
      });
    }

    const must_not_clauses: QueryDslQueryContainer[] = [];
    if (
      userPreferences?.excludedCategories &&
      userPreferences.excludedCategories.length > 0
    ) {
      must_not_clauses.push({
        terms: {
          categories: userPreferences.excludedCategories,
        },
      });
    }

    const should_clauses: QueryDslQueryContainer[] = [];
    if (
      userPreferences?.preferredCategories &&
      userPreferences.preferredCategories.length > 0
    ) {
      should_clauses.push({
        match: {
          categories: {
            query: userPreferences.preferredCategories.join(' '),
            boost: 2.0,
          },
        },
      });
    }

    const now = new Date().getTime();

    const stocksMap = userStocks.reduce((map, stock) => {
      if (stock.product) {
        map[stock.product.id] = stock.quantity;
      }
      return map;
    }, {});

    const dlcMap = userStocks.reduce((map, stock) => {
      if (stock.product && stock.dlc) {
        map[stock.product.id] = new Date(stock.dlc).getTime();
      }
      return map;
    }, {});

    const searchRequest = {
      collapse: {
        field: 'name.keyword',
      },
      index: this.recipesIndex,
      size: 20,
      body: {
        query: {
          function_score: {
            query: {
              bool: {
                must: must_clauses,
                must_not: must_not_clauses,
                should: should_clauses,
                minimum_should_match: should_clauses.length > 0 ? 1 : 0,
              },
            },
            functions: [
              {
                script_score: {
                  script: {
                    source: `
                      double dlcScore = 0.0;
                      if (params._source.ingredients == null || params._source.ingredients.isEmpty()) {
                        return 0.0;
                      }
                      for (def ingredient : params._source.ingredients) {
                        if (params.dlcs.containsKey(ingredient.productId) && params.stocks.containsKey(ingredient.productId)) {
                          long dlcTime = (long) params.dlcs[ingredient.productId];
                          long daysUntilExpiry = (dlcTime - params.now) / (1000 * 3600 * 24);
                          if (daysUntilExpiry >= 0 && daysUntilExpiry < 7) {
                            double urgency = (7.0 - daysUntilExpiry) / 7.0;
                            double quantity = (double) params.stocks[ingredient.productId];
                            dlcScore += urgency * Math.log(1.0 + quantity);
                          }
                        }
                      }
                      return dlcScore;
                    `,
                    params: { dlcs: dlcMap, now: now, stocks: stocksMap },
                  },
                },
                weight: 2.0,
              },
              {
                script_score: {
                  script: {
                    source: `
                      float availabilityScore = 0;
                      if (params._source.ingredients == null || params._source.ingredients.isEmpty()) {
                        return 1.0;
                      }
                      int totalIngredients = params._source.ingredients.size();
                      int availableIngredients = 0;
                      for (def ingredient : params._source.ingredients) {
                        if (params.stocks.containsKey(ingredient.productId)) {
                          availableIngredients++;
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
}
