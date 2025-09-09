import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HelpersModule } from 'src/common/helpers/helpers.module';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { RecipeIngredient } from 'src/recipes/entities/recipe-ingredient.entity';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { SpoonacularAdminController } from './controllers/spoonacular-admin.controller';
import { SpoonacularIngredientMapping } from './entities/spoonacular-ingredient-mapping.entity';
import { SpoonacularInstructionsSeedService } from './services/spoonacular-instructions-seed.service';
import { SpoonacularMappingService } from './services/spoonacular-mapping.service';
import { SpoonacularRecipesSeedService } from './services/spoonacular-recipes-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpoonacularIngredientMapping,
      Ingredient,
      Recipe,
      RecipeIngredient,
    ]),
    HelpersModule,
  ],
  controllers: [SpoonacularAdminController],
  providers: [
    SpoonacularMappingService,
    SpoonacularRecipesSeedService,
    SpoonacularInstructionsSeedService,
  ],
  exports: [
    SpoonacularMappingService,
    SpoonacularRecipesSeedService,
    SpoonacularInstructionsSeedService,
  ],
})
export class ExternalApisModule {}
