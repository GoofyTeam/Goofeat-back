import {
  Controller,
  Delete,
  Get,
  Param,
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
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { HouseholdService } from 'src/households/household.service';
import { FilterProductDto } from 'src/products/dto/filter-product.dto';
import { ProductService } from 'src/products/product.service';
import { RecipeService } from 'src/recipes/recipe.service';
import { StockLogService } from 'src/stocks/services/stock-log.service';
import { StockService } from 'src/stocks/stock.service';
import { User } from 'src/users/entity/user.entity';
import { Role } from 'src/users/enums/role.enum';

@ApiTags('Admin Dashboard')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly householdService: HouseholdService,
    private readonly productService: ProductService,
    private readonly recipeService: RecipeService,
    private readonly stockService: StockService,
    private readonly stockLogService: StockLogService,
  ) {}

  @Get('dashboard/overview')
  @ApiOperation({
    summary: "Vue d'ensemble du dashboard admin",
    description: 'Statistiques générales de la plateforme',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de la plateforme récupérées avec succès',
  })
  getDashboardOverview() {
    // Cette méthode devra être implémentée dans les services respectifs
    return {
      message: 'Dashboard overview endpoint - À implémenter dans les services',
      placeholder: true,
    };
  }

  @Get('households')
  @ApiOperation({
    summary: 'Gérer tous les foyers (Admin)',
    description: 'Liste de tous les foyers pour administration',
  })
  @SerializationGroups('household:admin')
  getAllHouseholds(@CurrentUser() admin: User) {
    // Cette méthode devra être ajoutée au HouseholdService
    return {
      message: 'Admin households endpoint - À implémenter',
      placeholder: true,
    };
  }

  @Get('products/all')
  @ApiOperation({
    summary: 'Gérer tous les produits (Admin)',
    description: 'Vue administrative de tous les produits avec leurs créateurs',
  })
  @SerializationGroups('product:admin')
  async getAllProductsAsAdmin(@Query() filterDto: FilterProductDto) {
    return this.productService.findAll(filterDto);
  }

  @Delete('products/:id/force')
  @ApiOperation({
    summary: "Suppression forcée d'un produit (Admin)",
    description: "Permet aux admins de supprimer n'importe quel produit",
  })
  async forceDeleteProduct(@Param('id') id: string) {
    return this.productService.remove(id);
  }

  @Get('audit/stock-logs')
  @ApiOperation({
    summary: 'Audit des logs de stocks',
    description: 'Voir tous les logs de stocks pour audit et surveillance',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filtrer par utilisateur',
  })
  @ApiQuery({
    name: 'householdId',
    required: false,
    description: 'Filtrer par foyer',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin (ISO format)',
  })
  getAuditLogs(
    @Query('userId') userId?: string,
    @Query('householdId') householdId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Cette méthode devra être implémentée dans StockLogService
    return {
      message: 'Audit logs endpoint - À implémenter avec filtres avancés',
      filters: { userId, householdId, startDate, endDate },
      placeholder: true,
    };
  }

  @Get('analytics/usage')
  @ApiOperation({
    summary: "Analytiques d'usage de la plateforme",
    description: "Métriques d'usage pour le dashboard admin",
  })
  getPlatformAnalytics() {
    return {
      message: 'Platform analytics endpoint - À implémenter',
      placeholder: true,
    };
  }
}
