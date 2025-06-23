import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
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
          'Faire cuire les pâtes selon les instructions du paquet.',
          'Pendant ce temps, faire revenir l’oignon et l’ail hachés dans un peu d’huile d’olive.',
          'Ajouter les tomates et le thon égoutté. Laisser mijoter 10 minutes.',
          'Égoutter les pâtes, les mélanger à la sauce et servir chaud.',
        ],
        ingredients: [
          { ingredientName: 'Pâtes', quantity: 400, unit: 'g' },
          { ingredientName: 'Thon au naturel', quantity: 200, unit: 'g' },
          { ingredientName: 'Tomate', quantity: 400, unit: 'g' },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: 'unité' },
          { ingredientName: 'Ail', quantity: 2, unit: 'gousses' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 2,
            unit: 'cs',
          },
        ],
      },
      {
        name: 'Pâtes à la Carbonara',
        description:
          'La véritable recette des pâtes à la carbonara, crémeuse et savoureuse.',
        imageUrl: 'https://picsum.photos/800/600?random=2',
        preparationTime: 10,
        cookingTime: 20,
        servings: 4,
        difficulty: Difficulty.INTERMEDIATE,
        nutriScore: NutriScore.D,
        categories: ['Plat principal', 'Pâtes'],
        instructions: [
          'Cuire les pâtes. Faire dorer les lardons. Mélanger les jaunes d’oeufs avec le parmesan. Hors du feu, mélanger le tout.',
        ],
        ingredients: [
          { ingredientName: 'Pâtes', quantity: 320, unit: 'g' },
          { ingredientName: 'Lardons', quantity: 150, unit: 'g' },
          { ingredientName: 'Oeuf', quantity: 4, unit: 'unités' },
          { ingredientName: 'Parmesan', quantity: 50, unit: 'g' },
          { ingredientName: 'Poivre noir', quantity: 1, unit: 'pincée' },
        ],
      },
      {
        name: 'Risotto aux champignons',
        description: 'Un risotto crémeux et parfumé aux champignons de Paris.',
        imageUrl: 'https://picsum.photos/800/600?random=3',
        preparationTime: 15,
        cookingTime: 30,
        servings: 4,
        difficulty: Difficulty.INTERMEDIATE,
        nutriScore: NutriScore.C,
        categories: ['Plat principal', 'Riz'],
        instructions: [
          'Faire revenir l’oignon. Ajouter le riz et le vin blanc. Incorporer le bouillon louche par louche. Ajouter les champignons et le parmesan.',
        ],
        ingredients: [
          { ingredientName: 'Riz Arborio', quantity: 300, unit: 'g' },
          { ingredientName: 'Champignons de Paris', quantity: 250, unit: 'g' },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: 'unité' },
          { ingredientName: 'Bouillon de volaille', quantity: 1, unit: 'L' },
          { ingredientName: 'Vin blanc sec', quantity: 15, unit: 'cl' },
          { ingredientName: 'Parmesan', quantity: 50, unit: 'g' },
        ],
      },
      {
        name: 'Poulet au citron et à l’ail',
        description: 'Un plat de poulet simple, rapide et plein de saveurs.',
        imageUrl: 'https://picsum.photos/800/600?random=4',
        preparationTime: 10,
        cookingTime: 25,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.A,
        categories: ['Plat principal', 'Volaille'],
        instructions: [
          'Faire dorer le poulet. Ajouter l’ail et le jus de citron. Laisser cuire à couvert.',
        ],
        ingredients: [
          { ingredientName: 'Filet de poulet', quantity: 4, unit: 'unités' },
          { ingredientName: 'Citron', quantity: 1, unit: 'unité' },
          { ingredientName: 'Ail', quantity: 3, unit: 'gousses' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 2,
            unit: 'cs',
          },
          { ingredientName: 'Persil plat', quantity: 1, unit: 'bouquet' },
        ],
      },
      {
        name: 'Salade de lentilles et légumes',
        description:
          'Une salade complète et nutritive, idéale pour un déjeuner léger.',
        imageUrl: 'https://picsum.photos/800/600?random=5',
        preparationTime: 20,
        cookingTime: 25,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.A,
        categories: ['Salade', 'Végétarien'],
        instructions: [
          'Cuire les lentilles. Couper les légumes en dés. Préparer une vinaigrette et mélanger le tout.',
        ],
        ingredients: [
          { ingredientName: 'Lentilles vertes', quantity: 250, unit: 'g' },
          { ingredientName: 'Carotte', quantity: 2, unit: 'unités' },
          { ingredientName: 'Poivron rouge', quantity: 1, unit: 'unité' },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: 'unité' },
          { ingredientName: 'Vinaigre de vin', quantity: 3, unit: 'cs' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 6,
            unit: 'cs',
          },
        ],
      },
      {
        name: 'Ratatouille simple',
        description:
          'Un grand classique de la cuisine provençale, plein de légumes du soleil.',
        imageUrl: 'https://picsum.photos/800/600?random=6',
        preparationTime: 20,
        cookingTime: 45,
        servings: 6,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.A,
        categories: ['Plat principal', 'Végétarien', 'Légumes'],
        instructions: [
          'Couper tous les légumes en morceaux. Les faire revenir à la poêle avec de l’huile d’olive, puis laisser mijoter à couvert.',
        ],
        ingredients: [
          { ingredientName: 'Courgette', quantity: 2, unit: 'unités' },
          { ingredientName: 'Poivron rouge', quantity: 2, unit: 'unités' },
          { ingredientName: 'Tomate', quantity: 4, unit: 'unités' },
          { ingredientName: 'Oignon jaune', quantity: 2, unit: 'unités' },
          { ingredientName: 'Ail', quantity: 3, unit: 'gousses' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 4,
            unit: 'cs',
          },
        ],
      },
      {
        name: 'Omelette aux champignons et persil',
        description: 'Une omelette simple et savoureuse pour un repas rapide.',
        imageUrl: 'https://picsum.photos/800/600?random=7',
        preparationTime: 5,
        cookingTime: 10,
        servings: 2,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.B,
        categories: ['Plat principal', 'Oeufs'],
        instructions: [
          'Faire sauter les champignons. Battre les oeufs avec le persil, saler, poivrer. Verser sur les champignons et cuire.',
        ],
        ingredients: [
          { ingredientName: 'Oeuf', quantity: 4, unit: 'unités' },
          { ingredientName: 'Champignons de Paris', quantity: 150, unit: 'g' },
          { ingredientName: 'Persil plat', quantity: 0.5, unit: 'bouquet' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 1,
            unit: 'cs',
          },
        ],
      },
      {
        name: 'Pâtes au poulet et à la crème',
        description: 'Un plat réconfortant et crémeux.',
        imageUrl: 'https://picsum.photos/800/600?random=8',
        preparationTime: 15,
        cookingTime: 20,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.D,
        categories: ['Plat principal', 'Pâtes', 'Volaille'],
        instructions: [
          'Faire cuire les pâtes. Émincer le poulet et le faire dorer. Ajouter la crème et laisser mijoter. Mélanger avec les pâtes.',
        ],
        ingredients: [
          {
            ingredientName: 'Pâtes',
            quantity: 300,
            unit: 'g',
          },
          {
            ingredientName: 'Filet de poulet',
            quantity: 2,
            unit: 'unités',
          },
          {
            ingredientName: 'Crème fraîche épaisse',
            quantity: 20,
            unit: 'cl',
          },
        ],
      },
      {
        name: 'Poêlée de courgettes à l’ail et au persil',
        description: 'Un accompagnement simple et rapide qui sent bon l’été.',
        imageUrl: 'https://picsum.photos/800/600?random=9',
        preparationTime: 10,
        cookingTime: 15,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.A,
        categories: ['Accompagnement', 'Légumes'],
        instructions: [
          'Couper les courgettes en rondelles. Les faire dorer à la poêle avec l’ail. Ajouter le persil en fin de cuisson.',
        ],
        ingredients: [
          { ingredientName: 'Courgette', quantity: 3, unit: 'unités' },
          { ingredientName: 'Ail', quantity: 2, unit: 'gousses' },
          { ingredientName: 'Persil plat', quantity: 0.5, unit: 'bouquet' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 2,
            unit: 'cs',
          },
        ],
      },
      {
        name: 'Poulet basquaise simplifié',
        description: 'Une version rapide du célèbre plat basque.',
        imageUrl: 'https://picsum.photos/800/600?random=10',
        preparationTime: 15,
        cookingTime: 35,
        servings: 4,
        difficulty: Difficulty.EASY,
        nutriScore: NutriScore.B,
        categories: ['Plat principal', 'Volaille'],
        instructions: [
          'Faire dorer le poulet. Ajouter les poivrons et les oignons émincés, puis les tomates. Laisser mijoter.',
        ],
        ingredients: [
          { ingredientName: 'Filet de poulet', quantity: 4, unit: 'unités' },
          { ingredientName: 'Poivron rouge', quantity: 2, unit: 'unités' },
          { ingredientName: 'Oignon jaune', quantity: 1, unit: 'unité' },
          { ingredientName: 'Tomate', quantity: 400, unit: 'g' },
          { ingredientName: 'Vin blanc sec', quantity: 10, unit: 'cl' },
          {
            ingredientName: "Huile d'olive vierge extra",
            quantity: 2,
            unit: 'cs',
          },
        ],
      },
    ];

    this.logger.log('Début de la création des recettes...');

    for (const recipeDef of recipeDefinitions) {
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
            unit: ingDef.unit,
            recipeId: savedRecipe.id,
          });
        })
        .filter((ing): ing is RecipeIngredient => ing !== null);

      if (recipeIngredients.length > 0) {
        await this.recipeIngredientRepository.save(recipeIngredients);
      }

      const finalRecipe = await this.recipeRepository.findOne({
        where: { id: savedRecipe.id },
        relations: ['ingredients', 'ingredients.ingredient'],
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
