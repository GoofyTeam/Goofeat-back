/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command, CommandRunner } from 'nest-commander';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Repository } from 'typeorm';

@Injectable()
@Command({
  name: 'debug:sync',
  description: 'Debug and sync recipes between PostgreSQL and Elasticsearch',
})
export class DebugSyncCommand extends CommandRunner {
  private readonly logger = new Logger(DebugSyncCommand.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
  ) {
    super();
  }

  async run(): Promise<void> {
    this.logger.log('🔍 Démarrage du debug de synchronisation...');

    try {
      // 1. Compter les recettes en PostgreSQL
      const postgresCount = await this.recipeRepository.count();
      this.logger.log(`📊 Recettes en PostgreSQL: ${postgresCount}`);

      // 2. Compter les recettes dans Elasticsearch
      const elasticCount = await this.elasticsearchService.countRecipes();
      this.logger.log(`📊 Recettes dans Elasticsearch: ${elasticCount}`);

      if (postgresCount === 0) {
        this.logger.warn('❌ Aucune recette en base PostgreSQL !');
        return;
      }

      if (elasticCount === 0 && postgresCount > 0) {
        this.logger.warn(
          '⚠️  Décalage détecté : PostgreSQL a des recettes mais pas Elasticsearch',
        );
        this.logger.log('🔄 Tentative de synchronisation...');

        // Récupérer quelques recettes avec leurs ingrédients
        const recipes = await this.recipeRepository.find({
          relations: [
            'ingredients',
            'ingredients.ingredient',
            'ingredients.ingredient.products',
          ],
          take: 5,
        });

        this.logger.log(
          `🔍 Exemples de recettes trouvées (${recipes.length}):`,
        );
        for (const recipe of recipes) {
          this.logger.log(
            `  - "${recipe.name}" (${recipe.ingredients.length} ingrédients)`,
          );

          // Essayer d'indexer cette recette
          try {
            await this.elasticsearchService.indexRecipe(recipe);
            this.logger.log(`  ✅ Indexée avec succès`);
          } catch (error) {
            this.logger.error(`  ❌ Erreur d'indexation: ${error.message}`);
          }
        }

        // Vérifier après réindexation
        const newElasticCount = await this.elasticsearchService.countRecipes();
        this.logger.log(
          `📊 Recettes dans Elasticsearch après sync: ${newElasticCount}`,
        );
      }

      // 3. Si on a des recettes, montrer des exemples d'ingrédients
      if (elasticCount > 0 || postgresCount > 0) {
        this.logger.log("🔍 Exemples d'ingrédients réels disponibles:");

        const sampleRecipes = await this.recipeRepository.find({
          relations: ['ingredients', 'ingredients.ingredient'],
          take: 3,
        });

        const allIngredients = new Set<string>();
        sampleRecipes.forEach((recipe) => {
          recipe.ingredients.forEach((ri) => {
            if (ri.ingredient?.name) {
              allIngredients.add(ri.ingredient.name);
            }
          });
        });

        const ingredientList = Array.from(allIngredients).slice(0, 10);
        ingredientList.forEach((ingredient) => {
          this.logger.log(`  • ${ingredient}`);
        });

        this.logger.log(
          `💡 Pour des tests réalistes, utilisez ces ingrédients au lieu des fictifs`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Erreur lors du debug:', error);
      throw error;
    }
  }
}
