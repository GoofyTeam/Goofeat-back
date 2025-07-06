import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Unit } from 'src/common/units/unit.enums';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Difficulty, NutriScore } from 'src/recipes/dto/create-recipe.dto';
import { RecipeIngredient } from 'src/recipes/entities/recipe-ingredient.entity';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { RecipeCreatedEvent } from 'src/recipes/events/recipe.events';
import RecipeEventName from 'src/recipes/events/recipe.events.name';
import { Repository } from 'typeorm';

@Injectable()
export class RecipeSeedService {
  private readonly logger = new Logger(RecipeSeedService.name);

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async seed(): Promise<void> {
    const ingredients = await this.ingredientRepository.find();
    if (ingredients.length === 0) {
      throw new Error(
        "Aucun ingrédient trouvé. Veuillez d'abord exécuter le seed des ingrédients.",
      );
    }

    const ingredientMap: Record<string, Ingredient> = {};
    ingredients.forEach((ing) => {
      ingredientMap[ing.name] = ing;
    });

    const recipeDefinitions = [
      {
        name: 'Pâtes au thon et à la tomate',
        description:
          'Un classique simple et rapide, parfait pour un repas de semaine.',
        imageUrl: 'https://picsum.photos/800/600?random=1',
        preparationTime: 10,
        cookingTime: 15,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.B,
        categories: ['Plat principal', 'Pâtes', 'Poisson'],
        instructions: [
          'Faire cuire les pâtes al dente.',
          'Égoutter le thon et l’émietter.',
          'Faire revenir l’ail dans l’huile d’olive, ajouter les tomates et le thon.',
          'Laisser mijoter 10 minutes.',
          'Ajouter les pâtes à la sauce et bien mélanger.',
        ],
        ingredients: [
          { ingredientName: 'Pâtes', quantity: 350, unit: Unit.G },
          { ingredientName: 'Thon au naturel', quantity: 140, unit: Unit.G },
          { ingredientName: 'Tomate', quantity: 400, unit: Unit.G },
          { ingredientName: 'Ail', quantity: 2, unit: Unit.PIECE },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 2,
            unit: Unit.TBSP,
          },
        ],
      },
      {
        name: 'Poulet au curry et lait de coco',
        description: 'Un plat exotique et crémeux, plein de saveurs.',
        imageUrl: 'https://picsum.photos/800/600?random=2',
        preparationTime: 15,
        cookingTime: 25,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.C,
        categories: ['Plat principal', 'Volaille', 'Exotique'],
        instructions: [
          'Couper le poulet en morceaux.',
          'Faire dorer le poulet dans une poêle avec un peu d’huile.',
          'Ajouter l’oignon émincé et faire revenir.',
          'Saupoudrer de curry, ajouter le lait de coco et laisser mijoter 20 minutes.',
          'Servir avec du riz.',
        ],
        ingredients: [
          { ingredientName: 'Filet de poulet', quantity: 500, unit: Unit.G },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: Unit.PIECE },
          { ingredientName: 'Lait de coco', quantity: 400, unit: Unit.ML },
          { ingredientName: 'Curry en poudre', quantity: 2, unit: Unit.TBSP },
          { ingredientName: 'Riz Arborio', quantity: 300, unit: Unit.G },
        ],
      },
      {
        name: 'Risotto aux champignons',
        description:
          'Un risotto crémeux et réconfortant aux champignons de Paris.',
        imageUrl: 'https://picsum.photos/800/600?random=3',
        preparationTime: 10,
        cookingTime: 30,
        servings: 4,
        difficulty: Difficulty.INTERMEDIATE,
        nutriScore: NutriScore.C,
        categories: ['Plat principal', 'Riz', 'Végétarien'],
        instructions: [
          'Nettoyer et émincer les champignons.',
          'Faire revenir l’ail et l’oignon dans l’huile, ajouter les champignons.',
          'Ajouter le riz et le faire nacrer.',
          'Verser le vin blanc et laisser évaporer.',
          'Ajouter le bouillon louche par louche jusqu’à cuisson complète du riz.',
          'Lier avec le parmesan et servir.',
        ],
        ingredients: [
          { ingredientName: 'Riz Arborio', quantity: 320, unit: Unit.G },
          {
            ingredientName: 'Champignons de Paris',
            quantity: 300,
            unit: Unit.G,
          },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: Unit.PIECE },
          { ingredientName: 'Ail', quantity: 1, unit: Unit.PIECE },
          { ingredientName: 'Vin blanc sec', quantity: 100, unit: Unit.ML },
          { ingredientName: 'Bouillon de volaille', quantity: 1, unit: Unit.L },
          { ingredientName: 'Parmesan', quantity: 50, unit: Unit.G },
        ],
      },
      {
        name: 'Pâtes à la carbonara',
        description:
          'La véritable recette italienne des pâtes à la carbonara, crémeuse et savoureuse.',
        imageUrl: 'https://picsum.photos/800/600?random=4',
        preparationTime: 15,
        cookingTime: 20,
        servings: 4,
        difficulty: Difficulty.INTERMEDIATE,
        nutriScore: NutriScore.D,
        categories: ['Plat principal', 'Pâtes', 'Classique'],
        instructions: [
          'Faire cuire les pâtes selon les instructions du paquet.',
          "Pendant ce temps, faire revenir les lardons dans une poêle jusqu'à ce qu'ils soient croustillants.",
          'Dans un bol, battre les œufs avec le parmesan râpé, du sel et du poivre.',
          "Égoutter les pâtes en conservant un peu d'eau de cuisson.",
          "Mélanger les pâtes chaudes avec les lardons, puis ajouter le mélange d'œufs et de fromage hors du feu.",
          "Ajouter un peu d'eau de cuisson pour obtenir une sauce onctueuse. Servir immédiatement.",
        ],
        ingredients: [
          { ingredientName: 'Pâtes', quantity: 400, unit: Unit.G },
          { ingredientName: 'Lardons', quantity: 150, unit: Unit.G },
          { ingredientName: 'Oeuf', quantity: 4, unit: Unit.PIECE },
          { ingredientName: 'Parmesan', quantity: 100, unit: Unit.G },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: Unit.PIECE },
        ],
      },
    ];

    this.logger.log('Début de la création des recettes...');

    for (const recipeDef of recipeDefinitions) {
      this.logger.log(`Processing recipe definition: ${recipeDef.name}`);
      const { ingredients: ingredientDefs, ...recipeData } = recipeDef;

      const recipe = this.recipeRepository.create(recipeData);
      const savedRecipe = await this.recipeRepository.save(recipe);

      const recipeIngredients = ingredientDefs
        .map((ingDef) => {
          const ingredient = ingredientMap[ingDef.ingredientName];
          if (!ingredient) {
            this.logger.warn(
              `Ingrédient générique "${ingDef.ingredientName}" non trouvé. Ignoré pour la recette "${recipe.name}".`,
            );

            return null;
          }
          return this.recipeIngredientRepository.create({
            ingredientId: ingredient.id,
            quantity: ingDef.quantity,
            unit: ingDef.unit as Unit,
            recipeId: savedRecipe.id,
          });
        })
        .filter((ing): ing is RecipeIngredient => ing !== null);

      if (recipeIngredients.length > 0) {
        await this.recipeIngredientRepository.save(recipeIngredients);
      }

      const finalRecipe = await this.recipeRepository.findOne({
        where: { id: savedRecipe.id },
        relations: [
          'ingredients',
          'ingredients.ingredient',
          'ingredients.ingredient.products',
        ],
      });

      if (finalRecipe) {
        this.logger.debug(
          `Final recipe object for ${finalRecipe.name}: ${JSON.stringify(
            finalRecipe,
            null,
            2,
          )}`,
        );

        await this.eventEmitter.emitAsync(
          RecipeEventName.RecipeCreated,
          new RecipeCreatedEvent(finalRecipe),
        );

        this.logger.log(`Recette "${finalRecipe.name}" créée.`);
      } else {
        this.logger.error(
          `La recette avec l'ID ${savedRecipe.id} n'a pas pu être retrouvée après sa création.`,
        );
      }
    }

    this.logger.log('Toutes les recettes ont été créées.');
  }
}
