import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Product } from 'src/products/entities/product.entity';
import { RecipeIngredient } from 'src/recipes/entities/recipe-ingredient.entity';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { Repository } from 'typeorm';
import { ProductSeedService } from './product.seed';

@Injectable()
export class SeederService {
  private readonly logger = new Logger(SeederService.name);

  constructor(
    private readonly productSeedService: ProductSeedService,
    @InjectRepository(Recipe)
    private readonly recipeRepository: Repository<Recipe>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
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
    this.logger.log('Base de données nettoyée.');
  }

  async seedAll() {
    this.logger.log('Démarrage du processus de seeding complet...');

    this.logger.log('Étape 1: Seeding des produits...');
    await this.productSeedService.seed();

    this.logger.log('Seeding terminé avec succès !');
    this.logger.log(
      '💡 Pour les recettes, utilisez: yarn nest start --exec="seed:spoonacular:recipes"',
    );
  }
}
