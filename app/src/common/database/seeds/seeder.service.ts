import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Category } from 'src/categories/entities/category.entity';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Product } from 'src/products/entities/product.entity';
import { RecipeIngredient } from 'src/recipes/entities/recipe-ingredient.entity';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Repository } from 'typeorm';
import { CategorySeedService } from './category.seed';
import { ProductSeedService } from './product.seed';
import { RecipeSeedService } from './recipe.seed';

@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly categorySeedService: CategorySeedService,
    private readonly productSeedService: ProductSeedService,
    private readonly recipeSeedService: RecipeSeedService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredientRepository: Repository<RecipeIngredient>,
  ) {}

  private async clearDatabase() {
    this.logger.log(
      'Nettoyage de la base de données avec TRUNCATE...CASCADE...',
    );
    // Utilisation d'une requête SQL brute pour vider toutes les tables en cascade
    // C'est plus efficace et gère les contraintes de clés étrangères automatiquement.
    // RESTART IDENTITY réinitialise les séquences des auto-incréments.
    await this.recipeIngredientRepository.query(
      'TRUNCATE TABLE "recipe_ingredients" RESTART IDENTITY CASCADE',
    );
    await this.recipeRepository.query(
      'TRUNCATE TABLE "recipes" RESTART IDENTITY CASCADE',
    );
    await this.productRepository.query(
      'TRUNCATE TABLE "products" RESTART IDENTITY CASCADE',
    );
    await this.categoryRepository.query(
      'TRUNCATE TABLE "categories" RESTART IDENTITY CASCADE',
    );
    this.logger.log('Base de données nettoyée.');
  }

  async seedAll() {
    this.logger.log('Démarrage du processus de seeding complet...');

    this.logger.log('Étape 3: Seeding des produits...');
    await this.productSeedService.seed();

    this.logger.log('Étape 4: Seeding des recettes...');
    await this.recipeSeedService.seed();

    this.logger.log('Seeding terminé avec succès !');
  }
}
