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
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { User } from 'src/users/entity/user.entity';
import { CreateStockDto } from './dto/create-stock.dto';
import { FilterStockDto } from './dto/filter-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Stock } from './entities/stock.entity';
import { StockService } from './stock.service';

@ApiTags('stocks')
@ApiBearerAuth()
@Controller('stock')
@UseGuards(AuthGuard('jwt'))
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
  @SerializationGroups('stock:read')
  create(@Body() createStockDto: CreateStockDto, @CurrentUser() user: User) {
    return this.stockService.create(createStockDto, user);
  }

  @ApiOperation({ summary: 'Créer plusieurs stocks en une seule requête' })
  @ApiBody({ type: [CreateStockDto] })
  @ApiResponse({
    status: 201,
    description: 'Stocks créés avec succès',
    type: [Stock],
  })
  @ApiResponse({ status: 400, description: 'Requête invalide' })
  @Post('bulk')
  @SerializationGroups('stock:read')
  createBulk(
    @Body() createStockDtos: CreateStockDto[],
    @CurrentUser() user: User,
  ) {
    return this.stockService.createBulk(createStockDtos, user);
  }

  @ApiOperation({ summary: 'Récupérer tous les stocks' })
  @ApiResponse({
    status: 200,
    description: 'Liste des stocks récupérée avec succès',
    type: [Stock],
  })
  @Get()
  @SerializationGroups('stock:list')
  findAll(@CurrentUser() user: User, @Query() filterStockDto: FilterStockDto) {
    console.log(filterStockDto);
    return this.stockService.findAll(user, filterStockDto);
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
  @SerializationGroups('stock:read')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.stockService.findOne(id, user);
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
  @SerializationGroups('stock:read')
  update(
    @Param('id') id: string,
    @Body() updateStockDto: UpdateStockDto,
    @CurrentUser() user: User,
  ) {
    return this.stockService.update(id, updateStockDto, user);
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
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.stockService.remove(id, user);
  }
}
