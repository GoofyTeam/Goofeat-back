import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { User } from '../entity/user.entity';
import { PersonalDashboardService } from '../services/personal-dashboard.service';

@ApiTags('Dashboard Personnel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('my/dashboard')
export class PersonalDashboardController {
  constructor(
    private readonly personalDashboardService: PersonalDashboardService,
  ) {}

  @Get('overview')
  @ApiOperation({
    summary: "Vue d'ensemble personnelle",
    description:
      "Statistiques générales de l'utilisateur connecté : stocks, gaspillage, économies",
  })
  @ApiResponse({
    status: 200,
    description: "Vue d'ensemble récupérée avec succès",
  })
  @SerializationGroups('dashboard:overview')
  async getPersonalOverview(@CurrentUser() user: User) {
    return this.personalDashboardService.getPersonalOverview(user);
  }

  @Get('anti-waste')
  @ApiOperation({
    summary: 'Dashboard anti-gaspillage personnel',
    description:
      'Métriques détaillées sur la réduction du gaspillage personnel',
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
  async getPersonalAntiWasteDashboard(
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.personalDashboardService.getPersonalAntiWasteMetrics(
      user,
      period,
    );
  }

  @Get('impact-environmental')
  @ApiOperation({
    summary: 'Impact environnemental personnel',
    description:
      "Calcul de l'impact écologique personnel : CO2 évité, eau économisée, etc.",
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    enum: ['30d', '90d', '1y'],
    example: '30d',
  })
  async getPersonalEnvironmentalImpact(
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.personalDashboardService.getPersonalEnvironmentalImpact(
      user,
      period,
    );
  }

  @Get('savings-report')
  @ApiOperation({
    summary: "Rapport d'économies personnel",
    description: 'Calcul des économies financières personnelles réalisées',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    example: '30d',
  })
  async getPersonalSavingsReport(
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.personalDashboardService.getPersonalSavingsReport(user, period);
  }

  @Get('waste-trends')
  @ApiOperation({
    summary: 'Tendances de gaspillage personnelles',
    description:
      'Évolution du gaspillage personnel dans le temps avec comparaisons',
  })
  @ApiQuery({
    name: 'compareWith',
    required: false,
    description: 'Période de comparaison',
    enum: ['previous_period', 'same_period_last_year'],
    example: 'previous_period',
  })
  async getPersonalWasteTrends(
    @CurrentUser() user: User,
    @Query('compareWith') compareWith: string = 'previous_period',
  ) {
    return this.personalDashboardService.getPersonalWasteTrends(
      user,
      compareWith,
    );
  }

  @Get('products-analysis')
  @ApiOperation({
    summary: 'Analyse personnelle par produits',
    description:
      'Détail du gaspillage personnel par type de produit avec recommandations',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    example: '30d',
  })
  async getPersonalProductsAnalysis(
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.personalDashboardService.getPersonalProductsWasteAnalysis(
      user,
      period,
    );
  }

  @Get('achievements')
  @ApiOperation({
    summary: 'Badges et réussites personnels',
    description:
      'Système de gamification personnel : badges débloqués, objectifs atteints',
  })
  async getPersonalAchievements(@CurrentUser() user: User) {
    return this.personalDashboardService.getPersonalAchievements(user);
  }

  @Get('weekly-summary')
  @ApiOperation({
    summary: 'Résumé hebdomadaire personnel',
    description:
      'Rapport hebdomadaire personnel avec insights et recommandations',
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
  async getPersonalWeeklySummary(
    @CurrentUser() user: User,
    @Query('week') week?: number,
    @Query('year') year?: number,
  ) {
    return this.personalDashboardService.getPersonalWeeklySummary(
      user,
      week,
      year,
    );
  }

  @Get('challenges')
  @ApiOperation({
    summary: 'Défis anti-gaspillage personnels',
    description: 'Défis personnalisés pour réduire le gaspillage personnel',
  })
  getPersonalChallenges(@CurrentUser() user: User) {
    return this.personalDashboardService.getPersonalAntiWasteChallenges(user);
  }

  @Get('households-summary')
  @ApiOperation({
    summary: "Résumé des foyers de l'utilisateur",
    description:
      "Vue d'ensemble de tous les foyers auxquels l'utilisateur appartient",
  })
  async getHouseholdsSummary(@CurrentUser() user: User) {
    return this.personalDashboardService.getUserHouseholdsSummary(user);
  }

  @Get('global-stats')
  @ApiOperation({
    summary: 'Statistiques globales utilisateur',
    description:
      "Combine les stats personnelles et des foyers de l'utilisateur",
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    example: '30d',
  })
  async getGlobalUserStats(
    @CurrentUser() user: User,
    @Query('period') period: string = '30d',
  ) {
    return this.personalDashboardService.getGlobalUserStats(user, period);
  }
}
