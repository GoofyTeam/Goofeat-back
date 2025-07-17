import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Paginate, PaginateQuery } from 'nestjs-paginate';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { CategoryService } from './category.service';

@ApiTags('categories')
@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @SerializationGroups('category:list')
  @ApiOperation({ summary: 'Récupérer toutes les catégories' })
  @ApiResponse({
    status: 200,
    description: 'Liste des catégories récupérée avec succès',
  })
  findAll(@Paginate() query: PaginateQuery) {
    return this.categoryService.findAll(query);
  }

  @Get(':id')
  @SerializationGroups('category:read')
  @ApiOperation({ summary: 'Récupérer une catégorie par son ID' })
  @ApiResponse({
    status: 200,
    description: 'Catégorie récupérée avec succès',
  })
  @ApiResponse({ status: 404, description: 'Catégorie non trouvée' })
  findOne(@Param('id') id: string) {
    return this.categoryService.findOne(id);
  }

  @Post('seed')
  @SerializationGroups('category:read')
  @ApiOperation({ summary: 'Créer les catégories initiales (seeds)' })
  @ApiResponse({
    status: 201,
    description: 'Catégories initiales créées avec succès',
  })
  seed() {
    return this.categoryService.createInitialCategories();
  }
}
