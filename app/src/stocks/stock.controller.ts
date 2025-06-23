import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Stock } from './entities/stock.entity';
import { StockService } from './stock.service';

@ApiTags('stocks')
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @ApiOperation({ summary: 'Créer un nouveau stock' })
  @ApiBody({ type: CreateStockDto })
  @ApiResponse({
    status: 201,
    description: 'Stock créé avec succès',
    type: Stock,
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @Post()
  create(@Body() createStockDto: CreateStockDto) {
    return this.stockService.create(createStockDto);
  }

  @ApiOperation({ summary: 'Récupérer tous les stocks' })
  @ApiResponse({
    status: 200,
    description: 'Liste des stocks récupérée avec succès',
    type: [Stock],
  })
  @Get()
  findAll() {
    return this.stockService.findAll();
  }

  @ApiOperation({ summary: 'Récupérer un stock par son ID' })
  @ApiParam({
    name: 'id',
    description: 'ID du stock',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({
    status: 200,
    description: 'Stock récupéré avec succès',
    type: Stock,
  })
  @ApiResponse({ status: 404, description: 'Stock non trouvé' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.stockService.findOne(+id);
  }

  @ApiOperation({ summary: 'Mettre à jour un stock' })
  @ApiParam({
    name: 'id',
    description: 'ID du stock',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiBody({ type: UpdateStockDto })
  @ApiResponse({
    status: 200,
    description: 'Stock mis à jour avec succès',
    type: Stock,
  })
  @ApiResponse({ status: 404, description: 'Stock non trouvé' })
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStockDto: UpdateStockDto) {
    return this.stockService.update(+id, updateStockDto);
  }

  @ApiOperation({ summary: 'Supprimer un stock' })
  @ApiParam({
    name: 'id',
    description: 'ID du stock',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({ status: 200, description: 'Stock supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Stock non trouvé' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.stockService.remove(+id);
  }
}
