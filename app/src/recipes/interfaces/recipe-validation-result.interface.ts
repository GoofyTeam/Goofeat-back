export interface RecipeValidationResult {
  success: boolean;
  message: string;
  recipe: {
    id: string;
    name: string;
    originalServings: number;
    requestedServings: number;
    scalingRatio: number;
  };
  ingredientsUsed: IngredientUsage[];
  stockUpdates: StockUpdate[];
  missingIngredients?: MissingIngredient[];
}

export interface IngredientUsage {
  ingredientId: string;
  ingredientName: string;
  originalQuantity: number;
  adjustedQuantity: number;
  unit: string;
  stockId?: string;
  stockQuantityBefore: number;
  stockQuantityAfter: number;
}

export interface StockUpdate {
  stockId: string;
  productName: string;
  quantityBefore: number;
  quantityAfter: number;
  quantityUsed: number;
  unit: string;
}

export interface MissingIngredient {
  ingredientId: string;
  ingredientName: string;
  requiredQuantity: number;
  availableQuantity: number;
  unit: string;
  shortage: number;
}

export interface StockSelection {
  success: boolean;
  stockUsages: StockUsage[];
  totalQuantity: number;
}

export interface StockUsage {
  stock: any; // Stock entity
  quantityToUse: number;
}
