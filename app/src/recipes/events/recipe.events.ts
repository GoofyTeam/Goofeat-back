import { Recipe } from '../entities/recipe.entity';

class RecipeEvent {
  constructor(public readonly recipe: Recipe) {}
}

export class RecipeCreatedEvent extends RecipeEvent {}

export class RecipeUpdatedEvent extends RecipeEvent {}

export class RecipeDeletedEvent extends RecipeEvent {}
