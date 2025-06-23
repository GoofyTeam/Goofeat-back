// import { Recipe } from 'src/recipes/entities/recipe.entity';

import { QueryDslBoolQuery } from '@elastic/elasticsearch/lib/api/types';

export interface ProductNutriments {
  nutrition_grade_fr?: string;
}

export interface Product {
  id?: string;
  name?: string;
  nutriments?: ProductNutriments;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  isOptional?: boolean;
  nutriScore?: string;
  productId: string;
  product?: Product;
}

//TODO a modifier apres
export interface ScoredRecipe extends RecipeTemp {
  score: number;
  customScore?: number;
  ingredients: RecipeIngredient[];
}

export interface RecipeSource {
  score: number | null | undefined;
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  preparationTime: number;
  cookingTime: number;
  servings: number;
  difficulty: string;
  nutriScore: string;
  categories: string[];
  ingredients: RecipeIngredient[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ElasticsearchBoolQuery {
  bool: QueryDslBoolQuery;
}

export interface RecipeSearchResult {
  total: number;
  results: ScoredRecipe[];
}

//TODO a modifier apres
// Interface pour une recette temporaire utilisée dans les résultats de recherche en attendant la veritable entité
export class RecipeTemp {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  preparationTime: number;
  cookingTime: number;
  servings: number;
  difficulty: string;
  nutriScore: string;
  categories: string[];
  ingredients: RecipeIngredient[];
  createdAt: Date;
  updatedAt: Date;
}
