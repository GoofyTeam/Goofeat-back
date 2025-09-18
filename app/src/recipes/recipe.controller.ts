/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Body,
  Controller,
  Delete,
  Get,
  Logger, // Ajout de Logger
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Paginated, PaginateQuery } from 'nestjs-paginate';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { ElasticsearchService } from 'src/common/elasticsearch/elasticsearch.service';
import { RecipeSearchResult } from 'src/common/elasticsearch/interfaces/recipe-search.interface';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { StockService } from 'src/stocks/stock.service';
import { User } from 'src/users/entity/user.entity';
import { UserPreferences } from 'src/users/interfaces/user-preferences.interface';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { ValidateRecipeDto } from './dto/validate-recipe.dto';
import { Recipe } from './entities/recipe.entity';
import { RecipeValidationResult } from './interfaces/recipe-validation-result.interface';
import { RecipeService } from './recipe.service';

@ApiTags('recipes')
@Controller('recipes')
export class RecipeController {
  private readonly logger = new Logger(RecipeController.name);
  constructor(
    private readonly recipeService: RecipeService,
    private readonly elasticsearchService: ElasticsearchService,
    private readonly stockService: StockService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('recipe:read')
  @ApiOperation({ summary: 'Créer une nouvelle recette' })
  @ApiResponse({
    status: 201,
    description: 'La recette a été créée avec succès',
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  create(@Body() createRecipeDto: CreateRecipeDto) {
    return this.recipeService.create(createRecipeDto);
  }

  @Get()
  @SerializationGroups('recipe:list')
  @ApiOperation({
    summary: 'Récupérer toutes les recettes avec pagination et filtres',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des recettes récupérée avec succès',
  })
  @ApiQuery({
    name: 'dlcFilter',
    required: false,
    description: 'Filtrer par DLC (ex: 7 pour les 7 prochains jours)',
    type: Number,
  })
  findAll(@Query() query: PaginateQuery): Promise<Paginated<Recipe>> {
    return this.recipeService.findAll(query);
  }

  @Get('/search')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('recipe:list')
  @ApiOperation({
    summary: 'Recherche de recettes avec scoring dynamique',
    description:
      "Recherche des recettes en fonction du stock et des DLCs de l'utilisateur",
  })
  @ApiQuery({
    name: 'query',
    required: false,
    description: 'Terme de recherche optionnel',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des recettes trouvées, ordonnées par pertinence',
  })
  async searchRelevantRecipes(
    @Req() req,
    @CurrentUser() user: User,
    @Query('query') query?: string,
  ): Promise<RecipeSearchResult> {
    const stockData = await this.stockService.findAll(user, { limit: 100 });
    const userStocks = stockData.data || [];
    let userPreferences: UserPreferences = {};
    if (user.preferences) {
      if (typeof user.preferences === 'string') {
        try {
          userPreferences = JSON.parse(user.preferences);
        } catch (e) {
          this.logger.error('Failed to parse user preferences JSON string:', e);
          userPreferences = {};
        }
      } else {
        userPreferences = user.preferences;
      }
    }
    // 🔧 CORRECTION: Utiliser searchRecipes quand un query est fourni, sinon discovery
    if (query && query.trim().length > 0) {
      this.logger.log(`Recherche textuelle avec query: "${query}"`);
      return this.elasticsearchService.searchRecipes(
        query.trim(),
        userPreferences,
        userStocks,
      );
    } else {
      this.logger.log('Découverte intelligente basée sur le stock');
      return this.elasticsearchService.discoverRecipes(
        userPreferences,
        userStocks,
      );
    }
  }

  @Get('/makeable')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('recipe:list')
  @ApiOperation({
    summary:
      'Trouver des recettes entièrement réalisables avec le stock actuel',
  })
  @ApiQuery({
    name: 'householdId',
    required: false,
    description: 'ID du foyer pour filtrer les stocks (optionnel)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des recettes réalisables, ordonnées par pertinence',
  })
  async findMakeableRecipes(
    @CurrentUser() user: User,
    @Query('householdId') householdId?: string,
  ): Promise<RecipeSearchResult> {
    const stockData = await this.stockService.findAll(user, {
      limit: 1000,
      householdId: householdId,
    });
    const userStocks = stockData.data || [];
    const userPreferences = user.preferences || {};

    // Debug logging
    this.logger.log(`User ID: ${user.id}, Email: ${user.email}`);
    this.logger.log(
      `HouseholdId filter: ${householdId || 'None (all households)'}`,
    );
    this.logger.log(`Stock count: ${userStocks.length}`);

    // Debug ingredient mapping
    const stocksWithIngredients = userStocks.filter(
      (stock) => stock.product?.ingredients?.length > 0,
    );
    this.logger.log(
      `Stocks with ingredient mapping: ${stocksWithIngredients.length}/${userStocks.length}`,
    );

    if (userStocks.length > 0) {
      this.logger.log(
        `First stock sample: ${JSON.stringify(
          {
            id: userStocks[0]?.id,
            productName: userStocks[0]?.product?.name,
            hasIngredients: !!userStocks[0]?.product?.ingredients?.length,
            ingredients:
              userStocks[0]?.product?.ingredients?.map((ing) => ({
                id: ing.id,
                name: ing.name,
              })) || [],
          },
          null,
          2,
        )}`,
      );
    }

    return this.elasticsearchService.findMakeableRecipes(
      userPreferences,
      userStocks,
    );
  }

  @Get(':id')
  @SerializationGroups('recipe:read')
  @ApiOperation({ summary: 'Récupérer une recette par son ID' })
  @ApiResponse({ status: 200, description: 'Recette trouvée' })
  @ApiResponse({ status: 404, description: 'Recette non trouvée' })
  findOne(@Param('id') id: string) {
    return this.recipeService.findOne(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('recipe:read')
  @ApiOperation({ summary: 'Mettre à jour une recette' })
  @ApiResponse({ status: 200, description: 'Recette mise à jour avec succès' })
  @ApiResponse({ status: 404, description: 'Recette non trouvée' })
  update(@Param('id') id: string, @Body() updateRecipeDto: UpdateRecipeDto) {
    return this.recipeService.update(id, updateRecipeDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Supprimer une recette' })
  @ApiResponse({ status: 200, description: 'Recette supprimée avec succès' })
  @ApiResponse({ status: 404, description: 'Recette non trouvée' })
  remove(@Param('id') id: string) {
    return this.recipeService.remove(id);
  }

  @Post(':id/validate')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Valider et cuisiner une recette',
    description:
      'Vérifie la disponibilité des ingrédients, ajuste les quantités selon le nombre de personnes et met à jour automatiquement le stock',
  })
  @ApiResponse({
    status: 200,
    description: 'Recette validée et stock mis à jour avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example:
            'Recette "Tarte aux pommes" préparée avec succès pour 6 personne(s)',
        },
        recipe: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string', example: 'Tarte aux pommes' },
            originalServings: { type: 'number', example: 4 },
            requestedServings: { type: 'number', example: 6 },
            scalingRatio: { type: 'number', example: 1.5 },
          },
        },
        ingredientsUsed: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ingredientName: { type: 'string', example: 'Pommes' },
              originalQuantity: { type: 'number', example: 4 },
              adjustedQuantity: { type: 'number', example: 6 },
              unit: { type: 'string', example: 'pièce' },
            },
          },
        },
        stockUpdates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productName: { type: 'string', example: 'Pommes Golden' },
              quantityBefore: { type: 'number', example: 10 },
              quantityAfter: { type: 'number', example: 4 },
              quantityUsed: { type: 'number', example: 6 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Ingrédients manquants ou quantité insuffisante',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example:
            'Impossible de préparer la recette : 2 ingrédient(s) manquant(s)',
        },
        missingIngredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ingredientName: { type: 'string', example: 'Beurre' },
              requiredQuantity: { type: 'number', example: 150 },
              availableQuantity: { type: 'number', example: 50 },
              shortage: { type: 'number', example: 100 },
              unit: { type: 'string', example: 'gramme' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 404, description: 'Recette non trouvée' })
  async validateRecipe(
    @Param('id') id: string,
    @Body() validateRecipeDto: ValidateRecipeDto,
    @CurrentUser() user: User,
  ): Promise<RecipeValidationResult> {
    return this.recipeService.validateRecipe(id, validateRecipeDto, user);
  }
}
