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
import { Stock } from 'src/stocks/entities/stock.entity';
import { User } from 'src/users/entity/user.entity';
import { UsersModule } from 'src/users/users.module';
import { DatabaseModule } from '../database.module';
import { CategorySeedService } from './category.seed';
import { ProductSeedService } from './product.seed';
import { RecipeSeedService } from './recipe.seed';
import { SeederService } from './seeder.service';
import { UserStockSeedService } from './user-stock.seed';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      Category,
      Ingredient,
      Product,
      Recipe,
      RecipeIngredient,
      Stock,
      User,
    ]),
    CategoryModule,
    IngredientsModule,
    ProductModule,
    RecipeModule,
    UsersModule,
    EventEmitterModule,
    ElasticsearchModule,
  ],
  providers: [
    CategorySeedService,
    ProductSeedService,
    RecipeSeedService,
    SeederService,
    UserStockSeedService,
  ],
  exports: [SeederService, UserStockSeedService],
})
export class SeederModule {}
