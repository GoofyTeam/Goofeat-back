import {
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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './entities/product.entity';
import { ProductService } from './product.service';

@ApiTags('products')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @ApiOperation({ summary: 'Créer un nouveau produit' })
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({
    status: 201,
    description: 'Produit créé avec succès',
    type: Product,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productService.create(createProductDto);
  }

  @ApiOperation({ summary: 'Récupérer tous les produits' })
  @ApiResponse({
    status: 200,
    description: 'Liste des produits récupérée avec succès',
    type: [Product],
  })
  @ApiQuery({
    name: 'groups',
    required: false,
    description: 'Groupes de sérialisation (séparés par des virgules)',
    example: 'product:list,default',
  })
  @SerializationGroups('product:list', 'default')
  @Get()
  findAll(@Query('groups') groups?: string) {
    return this.productService.findAll();
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
  @Post('barcode/:barcode')
  async createFromBarcode(
    @Param('barcode') barcode: string,
    @Query('groups') groups?: string,
  ) {
    const product = await this.productService.createFromBarcode(barcode);
    return product;
  }

  @ApiOperation({ summary: 'Mettre à jour un produit' })
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
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.productService.update(id, updateProductDto);
  }

  @ApiOperation({ summary: 'Supprimer un produit' })
  @ApiParam({
    name: 'id',
    description: 'ID du produit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({ status: 200, description: 'Produit supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
