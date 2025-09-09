import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { User } from 'src/users/entity/user.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductDto, ProductTypeFilter } from './dto/filter-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';

@ApiTags('products')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({
    summary: 'Créer un nouveau produit manuel',
    description:
      "Créer un produit personnalisé sans code-barres, associé à l'utilisateur connecté",
  })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Produit créé avec succès',
    type: Product,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @ApiResponse({ status: 401, description: 'Authentification requise' })
  @Post()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('product:read')
  create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.productService.create(createProductDto, user);
  }

  @ApiOperation({
    summary: 'Récupérer tous les produits avec filtres avancés',
    description:
      'Liste paginée des produits avec recherche, filtres par type et possibilité de voir uniquement ses produits manuels',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des produits récupérée avec succès',
    type: [Product],
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Recherche par nom de produit',
    example: 'Nutella',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ProductTypeFilter,
    description: 'Filtrer par type de produit',
    example: ProductTypeFilter.ALL,
  })
  @ApiQuery({
    name: 'onlyMyProducts',
    required: false,
    type: Boolean,
    description:
      'Afficher uniquement mes produits manuels (nécessite une authentification)',
    example: false,
  })
  @ApiQuery({
    name: 'code',
    required: false,
    description: 'Recherche par code-barres exact',
    example: '3017620422003',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre maximum de résultats',
    example: 20,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Décalage pour la pagination',
    example: 0,
  })
  @SerializationGroups('product:list', 'default')
  @Get()
  @ApiBearerAuth()
  findAll(
    @Query() filterDto: Partial<FilterProductDto>,
    @CurrentUser() user?: User,
  ) {
    return this.productService.findAll(filterDto, user);
  }

  @ApiOperation({ summary: 'Récupérer un produit par son ID' })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({
    status: 200,
    description: 'Produit récupéré avec succès',
    type: Product,
  })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  @ApiQuery({
    name: 'groups',
    required: false,
    description: 'Groupes de sérialisation (séparés par des virgules)',
    example: 'product:read,nutrition',
  })
  @SerializationGroups('product:read')
  @Get(':id')
  findOne(@Param('id') id: string, @Query('groups') groups?: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException(`Invalid UUID format: ${id}`);
    }

    return this.productService.findOne(id);
  }

  @ApiOperation({
    summary: 'Créer un produit depuis Open Food Facts par code-barres',
  })
  @ApiParam({
    name: 'barcode',
    description: 'Code-barres du produit',
    example: '3017620422003',
  })
  @ApiResponse({
    status: 201,
    description: 'Produit créé depuis OFF',
    type: Product,
  })
  @SerializationGroups('product:barcode-min')
  @Get('barcode/:barcode')
  async createFromBarcode(
    @Param('barcode') barcode: string,
    // @Query('groups') groups?: string,
  ) {
    const product = await this.productService.createFromBarcode(barcode);
    return product;
  }

  @ApiOperation({
    summary: 'Mettre à jour un produit',
    description:
      'Seuls les créateurs peuvent modifier leurs produits manuels. Les produits avec code-barres ne peuvent pas être modifiés.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({
    status: 200,
    description: 'Produit mis à jour avec succès',
    type: Product,
  })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  @ApiResponse({
    status: 403,
    description:
      'Permission refusée - Vous ne pouvez modifier que vos propres produits',
  })
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @SerializationGroups('product:read')
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.productService.update(id, updateProductDto, user);
  }

  @ApiOperation({
    summary: 'Supprimer un produit',
    description:
      'Seuls les créateurs peuvent supprimer leurs produits manuels. Les produits avec code-barres ne peuvent pas être supprimés.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({ status: 200, description: 'Produit supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  @ApiResponse({
    status: 403,
    description:
      'Permission refusée - Vous ne pouvez supprimer que vos propres produits',
  })
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.productService.remove(id, user);
  }
}
