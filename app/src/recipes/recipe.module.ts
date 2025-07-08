import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from 'src/common/elasticsearch/elasticsearch.module';
import { IngredientsModule } from 'src/ingredients/ingredients.module';
import { Stock } from 'src/stocks/entities/stock.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recipe, RecipeIngredient, Stock]),
    ElasticsearchModule,
    IngredientsModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}
