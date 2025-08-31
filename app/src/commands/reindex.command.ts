/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Command, CommandRunner, Option } from 'nest-commander';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Repository } from 'typeorm';

interface ReindexOptions {
  batch?: number;
  force?: boolean;
}

@Injectable()
@Command({
  name: 'reindex:recipes',
  description: 'Reindex all recipes from PostgreSQL to Elasticsearch',
})
export class ReindexRecipesCommand extends CommandRunner {
  private readonly logger = new Logger(ReindexRecipesCommand.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
  ) {
    super();
  }

  async run(passedParams: string[], options: ReindexOptions): Promise<void> {
    this.logger.log('🔄 Démarrage de la réindexation des recettes...');

    try {
      // 1. Compter les recettes en PostgreSQL
      const totalRecipes = await this.recipeRepository.count();
      this.logger.log(`📊 Total recettes à réindexer: ${totalRecipes}`);

      if (totalRecipes === 0) {
        this.logger.warn('❌ Aucune recette trouvée en PostgreSQL !');
        return;
      }

      // 2. Force recreation of index if requested
      if (options.force) {
        this.logger.log(
          "🗑️  Suppression et recréation de l'index Elasticsearch...",
        );

        // Delete existing index
        try {
          await this.elasticsearchService['client'].indices.delete({
            index: 'recipes',
          });
          this.logger.log('✅ Index supprimé');
        } catch (error) {
          this.logger.log("ℹ️  Index n'existait pas ou erreur de suppression");
        }

        // Recreate index
        await this.elasticsearchService.createRecipeIndex();
        this.logger.log('✅ Index recréé');
      }

      // 3. Batch processing
      const batchSize = options.batch || 50;
      let processed = 0;
      let indexed = 0;
      let errors = 0;

      this.logger.log(`🔄 Traitement par lots de ${batchSize} recettes...`);

      while (processed < totalRecipes) {
        const recipes = await this.recipeRepository.find({
          relations: [
            'ingredients',
            'ingredients.ingredient',
            'ingredients.ingredient.products',
          ],
          skip: processed,
          take: batchSize,
        });

        this.logger.log(
          `📦 Lot ${Math.floor(processed / batchSize) + 1}: traitement de ${recipes.length} recettes...`,
        );

        for (const recipe of recipes) {
          try {
            await this.elasticsearchService.indexRecipe(recipe);
            indexed++;
          } catch (error) {
            this.logger.error(
              `❌ Erreur indexation "${recipe.name}": ${error.message}`,
            );
            errors++;
          }
        }

        processed += recipes.length;

        if (processed % 100 === 0) {
          this.logger.log(
            `⏳ Progrès: ${processed}/${totalRecipes} (${Math.round((processed / totalRecipes) * 100)}%)`,
          );
        }
      }

      // 4. Force refresh and verify
      this.logger.log("🔄 Rafraîchissement de l'index...");
      try {
        await this.elasticsearchService['client'].indices.refresh({
          index: 'recipes',
        });
      } catch (error) {
        this.logger.warn('⚠️  Erreur rafraîchissement:', error.message);
      }

      // 5. Final count
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for index refresh
      const finalCount = await this.elasticsearchService.countRecipes();

      // 6. Results
      this.logger.log('✅ Réindexation terminée !');
      this.logger.log('📊 Résultats:');
      this.logger.log(`   • Recettes traitées: ${processed}`);
      this.logger.log(`   • Recettes indexées: ${indexed}`);
      this.logger.log(`   • Erreurs: ${errors}`);
      this.logger.log(`   • Total dans Elasticsearch: ${finalCount}`);

      if (finalCount !== indexed) {
        this.logger.warn(
          `⚠️  Décalage détecté: ${indexed} indexées vs ${finalCount} comptées`,
        );
      }
    } catch (error) {
      this.logger.error('❌ Erreur lors de la réindexation:', error);
      throw error;
    }
  }

  @Option({
    flags: '-b, --batch <number>',
    description: 'Taille des lots pour le traitement (défaut: 50)',
  })
  parseBatch(value: string): number {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error('La taille du lot doit être un nombre positif');
    }
    return parsed;
  }

  @Option({
    flags: '-f, --force',
    description: "Forcer la recréation complète de l'index",
  })
  parseForce(): boolean {
    return true;
  }
}
