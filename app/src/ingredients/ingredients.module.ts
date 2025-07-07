import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientsSyncService } from './ingredients-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient])],
  providers: [IngredientsSyncService],
  exports: [TypeOrmModule, IngredientsSyncService],
})
export class IngredientsModule {}
