import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { ElasticsearchModule } from 'src/common/elasticsearch/elasticsearch.module';
import { ExternalApisModule } from 'src/common/external-apis/external-apis.module';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { IngredientsModule } from 'src/ingredients/ingredients.module';
import { ProductModule } from 'src/products/product.module';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { StockModule } from 'src/stocks/stock.module';
import { UsersModule } from 'src/users/users.module';
import { HelpersModule } from 'src/common/helpers/helpers.module';
import { DebugSyncCommand } from './debug.command';
import { ImportIngredientsCommand } from './import.command';
import { ReindexRecipesCommand } from './reindex.command';
import { ImportSpoonacularInstructionsCommand } from './spoonacular-instructions.command';
import { ImportSpoonacularRecipesCommand } from './spoonacular.command';
import { CheckExpirationsCommand } from './check-expirations.command';
import {
  SetupTestUserCommand,
  TestAntiWasteCommand,
  TestBarcodeCommand,
  TestDiscoverCommand,
  TestMakeableCommand,
  TestPackagingCommand,
  TestSearchCommand,
} from './test.command';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient, Recipe]),
    AuthModule,
    ElasticsearchModule,
    ExternalApisModule,
    IngredientsModule,
    ProductModule,
    StockModule,
    UsersModule,
    NotificationsModule,
    HelpersModule,
  ],
  providers: [
    // Debug commands
    DebugSyncCommand,
    ReindexRecipesCommand,

    // Test commands
    SetupTestUserCommand,
    TestSearchCommand,
    TestDiscoverCommand,
    TestMakeableCommand,
    TestAntiWasteCommand,
    TestPackagingCommand,
    TestBarcodeCommand,

    // Import commands
    ImportIngredientsCommand,
    ImportSpoonacularRecipesCommand,
    ImportSpoonacularInstructionsCommand,

    // Notification commands
    CheckExpirationsCommand,
  ],
})
export class CommandsModule {}
