import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SerializationGroups } from '../common/serializer/serialization-groups.decorator';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { Ingredient } from './entities/ingredient.entity';
import { IngredientsService } from './ingredients.service';

@ApiTags('ingredients')
@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Rechercher des ingrédients' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Terme de recherche',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre maximum de résultats',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des ingrédients trouvés',
    type: [Ingredient],
  })
  @SerializationGroups('ingredient:list')
  async searchIngredients(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
  ): Promise<Ingredient[]> {
    return this.ingredientsService.searchIngredients(search, limit || 10);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un ingrédient par ID' })
  @ApiResponse({
    status: 200,
    description: 'Ingrédient trouvé',
    type: Ingredient,
  })
  @SerializationGroups('ingredient:read')
  async findOne(@Param('id') id: string): Promise<Ingredient> {
    return this.ingredientsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Créer un nouvel ingrédient' })
  @ApiResponse({
    status: 201,
    description: 'Ingrédient créé avec succès',
    type: Ingredient,
  })
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('ingredient:read')
  async create(
    @Body(ValidationPipe) createIngredientDto: CreateIngredientDto,
  ): Promise<Ingredient> {
    return this.ingredientsService.create(createIngredientDto);
  }
}
