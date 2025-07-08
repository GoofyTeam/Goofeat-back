import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryModule } from 'src/categories/category.module';
import { Category } from 'src/categories/entities/category.entity';
import { ElasticsearchModule } from 'src/common/elasticsearch/elasticsearch.module';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { IngredientsModule } from 'src/ingredients/ingredients.module';
import { Product } from 'src/products/entities/product.entity';
import { ProductModule } from 'src/products/product.module';
import { RecipeIngredient } from 'src/recipes/entities/recipe-ingredient.entity';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { RecipeModule } from 'src/recipes/recipe.module';
import { DatabaseModule } from '../database.module';
import { CategorySeedService } from './category.seed';
import { IngredientSeedService } from './ingredient.seed';
import { ProductSeedService } from './product.seed';
import { RecipeSeedService } from './recipe.seed';
import { SeederService } from './seeder.service';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      Category,
      Ingredient,
      Product,
      Recipe,
      RecipeIngredient,
    ]),
    CategoryModule,
    IngredientsModule,
    ProductModule,
    RecipeModule,
    EventEmitterModule,
    ElasticsearchModule,
  ],
  providers: [
    CategorySeedService,
    IngredientSeedService,
    ProductSeedService,
    RecipeSeedService,
    SeederService,
  ],
  exports: [SeederService],
})
export class SeederModule {}
