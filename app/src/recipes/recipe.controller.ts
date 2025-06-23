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
import { UserPreferences } from 'src/common/elasticsearch/interfaces/scoring-config.interface';
import { User } from 'src/users/entity/user.entity';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { Recipe } from './entities/recipe.entity';
import { RecipeService } from './recipe.service';

@ApiTags('recipes')
@Controller('recipes')
export class RecipeController {
  private readonly logger = new Logger(RecipeController.name);
  constructor(
    private readonly recipeService: RecipeService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
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
    type: Boolean,
    description:
      'Filtre pour inclure uniquement les recettes réalisables avec le stock actuel (anti-gaspillage)',
  })
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  findAll(
    @Query() query: PaginateQuery,
    @CurrentUser() user: User,
    @Query('dlcFilter') dlcFilter?: boolean,
  ): Promise<Paginated<Recipe>> {
    return this.recipeService.findAll(query, dlcFilter ? user : undefined);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer une recette par son ID' })
  @ApiResponse({ status: 200, description: 'Recette trouvée' })
  @ApiResponse({ status: 404, description: 'Recette non trouvée' })
  findOne(@Param('id') id: string) {
    return this.recipeService.findOne(id);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
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

  @Get('/search')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
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
    const userStocks = user.stocks || [];
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
        userPreferences = user.preferences as UserPreferences;
      }
    }
    return this.elasticsearchService.searchRecipes(
      query || '',
      userStocks,
      userPreferences,
    );
  }

  /**
   * Endpoint de réindexation (réservé aux administrateurs)
   * À protéger avec un guard d'administration en production
   */
  @Get('/search/reindex')
  @UseGuards(AuthGuard('jwt')) // À remplacer par un guard admin si besoin
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Réindexer toutes les recettes',
    description:
      'Force la réindexation de toutes les recettes (opération admin)',
  })
  async reindexAll(): Promise<{ success: boolean; message: string }> {
    // Ici, on suppose que toutes les recettes sont accessibles via le service
    // et qu'elles sont bien indexées ensuite
    // À adapter si besoin
    // TODO: ajouter un vrai guard admin
    return { success: true, message: 'Réindexation simulée.' };
  }
}
