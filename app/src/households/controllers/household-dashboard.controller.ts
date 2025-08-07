import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { SerializationGroups } from 'src/common/serializer/serialization-groups.decorator';
import { User } from 'src/users/entity/user.entity';
import { HouseholdDashboardService } from '../services/household-dashboard.service';

@ApiTags('Dashboard Foyer')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('household/:householdId/dashboard')
export class HouseholdDashboardController {
  constructor(private readonly dashboardService: HouseholdDashboardService) {}

  @Get('overview')
  @ApiOperation({
    summary: "Vue d'ensemble du foyer",
    description:
      'Statistiques générales du foyer connecté : stocks, gaspillage, économies',
  })
  @ApiResponse({
    status: 200,
    description: "Vue d'ensemble récupérée avec succès",
  })
  @SerializationGroups('dashboard:overview')
  async getHouseholdOverview(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
  ) {
    return this.dashboardService.getHouseholdOverview(householdId, user);
  }

  @Get('anti-waste')
  @ApiOperation({
    summary: 'Dashboard anti-gaspillage',
    description: 'Métriques détaillées sur la réduction du gaspillage du foyer',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    enum: ['7d', '30d', '90d', '1y'],
    example: '30d',
  })
  @ApiResponse({
    status: 200,
    description: 'Métriques anti-gaspillage récupérées avec succès',
  })
  async getAntiWasteDashboard(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.dashboardService.getAntiWasteMetrics(householdId, user, period);
  }

  @Get('impact-environmental')
  @ApiOperation({
    summary: 'Impact environnemental du foyer',
    description:
      "Calcul de l'impact écologique : CO2 évité, eau économisée, etc.",
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    enum: ['30d', '90d', '1y'],
    example: '30d',
  })
  async getEnvironmentalImpact(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.dashboardService.getEnvironmentalImpact(
      householdId,
      user,
      period,
    );
  }

  @Get('savings-report')
  @ApiOperation({
    summary: "Rapport d'économies",
    description:
      'Calcul des économies financières réalisées grâce à la réduction du gaspillage',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    example: '30d',
  })
  async getSavingsReport(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.dashboardService.getSavingsReport(householdId, user, period);
  }

  @Get('waste-trends')
  @ApiOperation({
    summary: 'Tendances de gaspillage',
    description: 'Évolution du gaspillage dans le temps avec comparaisons',
  })
  @ApiQuery({
    name: 'compareWith',
    required: false,
    description: 'Période de comparaison',
    enum: ['previous_period', 'same_period_last_year'],
    example: 'previous_period',
  })
  async getWasteTrends(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
    @Query('compareWith') compareWith: string = 'previous_period',
  ) {
    return this.dashboardService.getWasteTrends(householdId, user, compareWith);
  }

  @Get('products-analysis')
  @ApiOperation({
    summary: 'Analyse par produits',
    description:
      'Détail du gaspillage par type de produit avec recommandations',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    example: '30d',
  })
  async getProductsAnalysis(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.dashboardService.getProductsWasteAnalysis(
      householdId,
      user,
      period,
    );
  }

  @Get('achievements')
  @ApiOperation({
    summary: 'Badges et réussites',
    description:
      'Système de gamification : badges débloqués, objectifs atteints',
  })
  async getAchievements(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
  ) {
    return this.dashboardService.getHouseholdAchievements(householdId, user);
  }

  @Get('weekly-summary')
  @ApiOperation({
    summary: 'Résumé hebdomadaire',
    description: 'Rapport hebdomadaire avec insights et recommandations',
  })
  @ApiQuery({
    name: 'week',
    required: false,
    description: 'Numéro de semaine (défaut: semaine courante)',
    type: Number,
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Année (défaut: année courante)',
    type: Number,
  })
  async getWeeklySummary(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
    @Query('week') week?: number,
    @Query('year') year?: number,
  ) {
    return this.dashboardService.getWeeklySummary(
      householdId,
      user,
      week,
      year,
    );
  }

  @Get('challenges')
  @ApiOperation({
    summary: 'Défis anti-gaspillage',
    description: 'Défis personnalisés pour réduire le gaspillage',
  })
  async getChallenges(
    @Param('householdId') householdId: string,
    @CurrentUser() user: User,
  ) {
    return this.dashboardService.getAntiWasteChallenges(householdId, user);
  }
}
