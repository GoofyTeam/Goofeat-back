import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from 'src/common/elasticsearch/elasticsearch.module';
import { IngredientsModule } from 'src/ingredients/ingredients.module';
import { StockLog } from 'src/stocks/entities/stock-log.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recipe, RecipeIngredient, Stock, StockLog]),
    ElasticsearchModule,
    IngredientsModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [RecipeController],
  providers: [RecipeService],
  exports: [RecipeService],
})
export class RecipeModule {}
