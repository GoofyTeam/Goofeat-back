import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from '../../ingredients/entities/ingredient.entity';
import { IngredientMatcherHelper } from './ingredient-matcher.helper';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient])],
  providers: [IngredientMatcherHelper],
  exports: [IngredientMatcherHelper],
})
export class HelpersModule {}
