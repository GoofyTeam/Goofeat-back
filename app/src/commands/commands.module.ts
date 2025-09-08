import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from 'src/common/elasticsearch/elasticsearch.module';
import { ExternalApisModule } from 'src/common/external-apis/external-apis.module';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { ProductModule } from 'src/products/product.module';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { DebugSyncCommand } from './debug.command';
import { ImportIngredientsCommand } from './import.command';
import { ReindexRecipesCommand } from './reindex.command';
import { ImportSpoonacularInstructionsCommand } from './spoonacular-instructions.command';
import { ImportSpoonacularRecipesCommand } from './spoonacular.command';
import {
  TestBarcodeCommand,
  TestDiscoverCommand,
  TestPackagingCommand,
  TestSearchCommand,
} from './test.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient, Recipe]),
    ElasticsearchModule,
    ExternalApisModule,
    ProductModule,
  ],
  providers: [
    // Debug commands
    DebugSyncCommand,
    ReindexRecipesCommand,

    // Test commands
    TestSearchCommand,
    TestDiscoverCommand,
    TestPackagingCommand,
    TestBarcodeCommand,

    // Import commands
    ImportIngredientsCommand,
    ImportSpoonacularRecipesCommand,
    ImportSpoonacularInstructionsCommand,
  ],
})
export class CommandsModule {}
