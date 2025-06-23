import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import {
  RecipeCreatedEvent,
  RecipeDeletedEvent,
  RecipeUpdatedEvent,
} from 'src/recipes/events/recipe.events';
import RecipeEventName from 'src/recipes/events/recipe.events.name';
import { Repository } from 'typeorm';
import { ElasticsearchService } from '../elasticsearch.service';

@Injectable()
export class RecipeListener {
  private readonly logger = new Logger(RecipeListener.name);

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
  ) {}

  @OnEvent(RecipeEventName.RecipeCreated)
  async handleRecipeCreatedEvent(event: RecipeCreatedEvent) {
    this.logger.log(
      `Nouvelle recette créée, id: ${event.recipe.id}. Récupération complète pour l'indexation...`,
    );
    const recipe = await this.recipeRepository.findOne({
      where: { id: event.recipe.id },
      relations: [
        'ingredients',
        'ingredients.ingredient',
        'ingredients.ingredient.products',
      ],
    });

    if (!recipe) {
      this.logger.error(
        `Recette avec l'id ${event.recipe.id} non trouvée après création.`,
      );
      return;
    }

    await this.elasticsearchService.indexRecipe(recipe);
  }

  @OnEvent(RecipeEventName.RecipeUpdated)
  async handleRecipeUpdatedEvent(event: RecipeUpdatedEvent) {
    this.logger.log(
      `Recette mise à jour, id: ${event.recipe.id}. Récupération complète pour l'indexation...`,
    );
    const recipe = await this.recipeRepository.findOne({
      where: { id: event.recipe.id },
      relations: [
        'ingredients',
        'ingredients.ingredient',
        'ingredients.ingredient.products',
      ],
    });

    if (!recipe) {
      this.logger.error(
        `Recette avec l'id ${event.recipe.id} non trouvée après mise à jour.`,
      );
      return;
    }
    await this.elasticsearchService.updateRecipeInIndex(recipe);
  }

  @OnEvent(RecipeEventName.RecipeDeleted)
  async handleRecipeDeletedEvent(event: RecipeDeletedEvent) {
    await this.elasticsearchService.removeRecipeFromIndex(event.recipe.id);
  }
}
