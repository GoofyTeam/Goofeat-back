import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { Role } from 'src/users/enums/role.enum';
import { SpoonacularIngredientMapping } from '../entities/spoonacular-ingredient-mapping.entity';
import { SpoonacularMappingService } from '../services/spoonacular-mapping.service';

interface CreateManualMappingDto {
  spoonacularId: number;
  spoonacularName: string;
  ingredientId: string;
}

@ApiTags('Administration Spoonacular')
@ApiBearerAuth()
@Controller('admin/spoonacular')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class SpoonacularAdminController {
  constructor(private readonly mappingService: SpoonacularMappingService) {}

  @Get('mappings/stats')
  @ApiOperation({
    summary: 'Statistiques des mappings Spoonacular',
    description:
      "Récupère les statistiques globales des mappings d'ingrédients",
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
  })
  async getMappingStats() {
    return this.mappingService.getMappingStats();
  }

  @Get('mappings/unvalidated')
  @ApiOperation({
    summary: 'Mappings non validés',
    description:
      'Liste des mappings automatiques qui nécessitent une validation manuelle',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre de résultats (défaut: 50)',
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Décalage pour la pagination (défaut: 0)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Mappings non validés récupérés avec succès',
  })
  @SerializationGroups('mapping:read')
  async getUnvalidatedMappings(
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    return this.mappingService.getUnvalidatedMappings(limit, offset);
  }

  @Post('mappings/manual')
  @ApiOperation({
    summary: 'Créer un mapping manuel',
    description:
      'Crée un mapping manuel entre un ingrédient Spoonacular et un ingrédient local',
  })
  @ApiResponse({
    status: 201,
    description: 'Mapping manuel créé avec succès',
    type: SpoonacularIngredientMapping,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  @SerializationGroups('mapping:read')
  async createManualMapping(
    @Body() createMappingDto: CreateManualMappingDto,
  ): Promise<SpoonacularIngredientMapping> {
    const { spoonacularId, spoonacularName, ingredientId } = createMappingDto;

    return this.mappingService.createManualMapping(
      spoonacularId,
      spoonacularName,
      ingredientId,
    );
  }

  @Patch('mappings/:mappingId/validate')
  @ApiOperation({
    summary: 'Valider un mapping',
    description: 'Marque un mapping automatique comme validé',
  })
  @ApiResponse({
    status: 200,
    description: 'Mapping validé avec succès',
    type: SpoonacularIngredientMapping,
  })
  @ApiResponse({
    status: 404,
    description: 'Mapping non trouvé',
  })
  @SerializationGroups('mapping:read')
  async validateMapping(
    @Param('mappingId') mappingId: string,
  ): Promise<SpoonacularIngredientMapping> {
    return this.mappingService.validateMapping(mappingId);
  }
}
