import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { ProductSeedService } from './product.seed';
import { SeederService } from './seeder.service';
import { UserStockSeedService } from './user-stock.seed';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([
      Ingredient,
      Product,
      Recipe,
      RecipeIngredient,
      Stock,
      User,
    ]),
    IngredientsModule,
    ProductModule,
    RecipeModule,
    UsersModule,
    EventEmitterModule,
    ElasticsearchModule,
  ],
  providers: [ProductSeedService, SeederService, UserStockSeedService],
  exports: [SeederService, UserStockSeedService],
})
export class SeederModule {}
