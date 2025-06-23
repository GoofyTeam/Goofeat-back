import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FilterOperator,
  PaginateQuery,
  Paginated,
  paginate,
} from 'nestjs-paginate';
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { Repository } from 'typeorm';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';
import RecipeEventName from './events/recipe.events.name';

@Injectable()
export class RecipeService {
  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(createRecipeDto: CreateRecipeDto): Promise<Recipe> {
    const { ingredients: ingredientsDto, ...recipeData } = createRecipeDto;

    const recipe = this.recipeRepository.create(recipeData);
    const savedRecipe = await this.recipeRepository.save(recipe);

    if (ingredientsDto && ingredientsDto.length > 0) {
      const recipeIngredients = ingredientsDto.map((ingredientDto) => {
        return this.recipeIngredientRepository.create({
          ...ingredientDto, // Contient ingredientId, quantity, unit, etc.
          recipeId: savedRecipe.id,
        });
      });
      await this.recipeIngredientRepository.save(recipeIngredients);
    }

    const recipeWithRelations = await this.recipeRepository.findOne({
      where: { id: savedRecipe.id },
      relations: [
        'ingredients',
        'ingredients.ingredient',
        'ingredients.ingredient.products',
        'ingredients.ingredient.category',
      ],
    });

    if (!recipeWithRelations) {
      throw new NotFoundException(
        `Recipe with ID ${savedRecipe.id} not found after creation`,
      );
    }

    this.eventEmitter.emit(RecipeEventName.RecipeCreated, recipeWithRelations);

    return recipeWithRelations;
  }

  async findAll(query: PaginateQuery, user?: User): Promise<Paginated<Recipe>> {
    const queryBuilder = this.recipeRepository
      .createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.ingredients', 'recipeIngredient')
      .leftJoinAndSelect('recipeIngredient.ingredient', 'ingredient');

    if (user && user.stocks && user.stocks.length > 0) {
      const userProductIds = user.stocks.map((stock) => stock.product.id);

      // Sous-requête pour trouver les recettes dont TOUS les ingrédients sont dans le stock de l'utilisateur
      queryBuilder.andWhere(
        (qb) => {
          const subQuery = qb
            .subQuery()
            .select('r.id')
            .from(Recipe, 'r')
            .leftJoin('r.ingredients', 'ri')
            .leftJoin('ri.ingredient', 'ing')
            .leftJoin('ing.products', 'p')
            .where('p.id IS NOT NULL') // S'assurer qu'il y a un produit associé
            .groupBy('r.id')
            .having(
              'COUNT(DISTINCT ing.id) = SUM(CASE WHEN p.id IN (:...userProductIds) THEN 1 ELSE 0 END)',
            )
            .getQuery();
          return 'recipe.id IN ' + subQuery;
        },
        { userProductIds },
      );
    }

    return paginate(query, queryBuilder, {
      sortableColumns: [
        'id',
        'name',
        'createdAt',
        'updatedAt',
        'difficulty',
        'cookingTime',
      ],
      searchableColumns: ['name', 'description', 'categories'],
      defaultSortBy: [['createdAt', 'DESC']],
      filterableColumns: {
        categories: [FilterOperator.IN],
        difficulty: [FilterOperator.EQ, FilterOperator.LTE, FilterOperator.GTE],
        cookingTime: [
          FilterOperator.LT,
          FilterOperator.GT,
          FilterOperator.LTE,
          FilterOperator.GTE,
        ],
      },
    });
  }

  async findOne(id: string): Promise<Recipe> {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: [
        'ingredients',
        'ingredients.ingredient',
        'ingredients.ingredient.category',
      ],
    });

    if (!recipe) {
      throw new NotFoundException(`Recette avec l'ID ${id} non trouvée`);
    }

    return recipe;
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto): Promise<Recipe> {
    const existingRecipe = await this.findOne(id);

    const { ingredients: ingredientsDto, ...recipeData } = updateRecipeDto;

    this.recipeRepository.merge(existingRecipe, recipeData);

    if (ingredientsDto) {
      await this.recipeIngredientRepository.delete({ recipeId: id });

      const newRecipeIngredients = ingredientsDto.map((ingredientDto) => {
        return this.recipeIngredientRepository.create({
          ...ingredientDto,
          recipeId: id,
        });
      });

      await this.recipeIngredientRepository.save(newRecipeIngredients);
    }

    await this.recipeRepository.save(existingRecipe);

    const updatedRecipeWithRelations = await this.recipeRepository.findOne({
      where: { id: id },
      relations: [
        'ingredients',
        'ingredients.ingredient',
        'ingredients.ingredient.category',
      ],
    });

    if (!updatedRecipeWithRelations) {
      throw new NotFoundException(
        `Recipe with ID ${id} not found after update`,
      );
    }

    this.eventEmitter.emit(
      RecipeEventName.RecipeUpdated,
      updatedRecipeWithRelations,
    );

    return updatedRecipeWithRelations;
  }

  async remove(id: string): Promise<void> {
    const recipe = await this.findOne(id);
    await this.recipeRepository.remove(recipe);
    this.eventEmitter.emit(RecipeEventName.RecipeDeleted, recipe);
  }
}
