import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
import { Role } from 'src/users/enums/role.enum';
import { AuditService } from '../audit/audit.service';

@ApiTags('Monitoring & Analytics')
@ApiBearerAuth()
@Controller('monitoring')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class MonitoringController {
  constructor(private readonly auditService: AuditService) {}

  @Get('health/platform')
  @ApiOperation({
    summary: 'État de santé de la plateforme',
    description: 'Métriques de performance et santé générale',
  })
  @ApiResponse({
    status: 200,
    description: 'Métriques de santé récupérées avec succès',
  })
  async getPlatformHealth() {
    const stats = await this.auditService.getPlatformStats();

    return {
      status: 'healthy',
      timestamp: new Date(),
      metrics: {
        ...stats,
        performance: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
        },
      },
    };
  }

  @Get('alerts/suspicious')
  @ApiOperation({
    summary: 'Activités suspectes détectées',
    description: 'Alertes de sécurité et comportements anormaux',
  })
  async getSuspiciousActivity() {
    return this.auditService.getSuspiciousActivity();
  }

  @Get('analytics/usage-trends')
  @ApiOperation({
    summary: "Tendances d'utilisation",
    description: "Analyse des tendances d'usage sur différentes périodes",
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: "Période d'analyse",
    enum: ['7d', '30d', '90d', '1y'],
  })
  getUsageTrends(@Query('period') period: string = '30d') {
    // À implémenter avec des requêtes analytiques
    return {
      period,
      trends: {
        activeUsers: [],
        stockOperations: [],
        wasteReduction: [],
        householdGrowth: [],
      },
      insights: [
        'Les utilisateurs sont plus actifs le weekend',
        'Le gaspillage diminue de 15% par rapport au mois dernier',
        "Pic d'activité entre 18h et 20h",
      ],
    };
  }

  @Get('reports/waste-analytics')
  @ApiOperation({
    summary: 'Analyses anti-gaspillage',
    description: 'Métriques détaillées sur la réduction du gaspillage',
  })
  @ApiQuery({
    name: 'householdId',
    required: false,
    description: 'Analyser un foyer spécifique',
  })
  getWasteAnalytics(@Query('householdId') householdId?: string) {
    return {
      householdId: householdId || 'all',
      period: 'last_30_days',
      metrics: {
        totalWasteReduced: 45.2, // kg
        moneySaved: 127.5, // euros
        co2Reduced: 23.1, // kg CO2 équivalent
        topWastedProducts: [
          { product: 'Légumes', waste: 12.3, trend: -5.2 },
          { product: 'Pain', waste: 8.7, trend: -2.1 },
          { product: 'Produits laitiers', waste: 6.4, trend: +1.2 },
        ],
        bestPerformingHouseholds: [
          { id: 'house1', name: 'Famille Martin', wasteReduction: 67 },
          { id: 'house2', name: 'Coloc des Lilas', wasteReduction: 54 },
        ],
      },
    };
  }

  @Get('exports/compliance/:userId')
  @ApiOperation({
    summary: 'Export des données utilisateur (RGPD)',
    description: 'Export complet des données pour conformité RGPD',
  })
  async exportUserData(@Param('userId') userId: string) {
    return this.auditService.exportUserData(userId);
  }

  @Get('logs/real-time')
  @ApiOperation({
    summary: 'Logs en temps réel',
    description: 'Stream des logs système pour monitoring live',
  })
  @ApiQuery({
    name: 'level',
    required: false,
    description: 'Niveau de log à filtrer',
    enum: ['error', 'warn', 'info', 'debug'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Nombre de logs à retourner',
  })
  getRealTimeLogs(
    @Query('level') level?: string,
    @Query('limit') limit: number = 100,
  ) {
    // À implémenter avec un système de streaming des logs
    return {
      level: level || 'all',
      limit,
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          context: 'StockService',
          message: 'Stock created successfully',
          userId: 'user123',
          metadata: { stockId: 'stock456' },
        },
      ],
      streaming: false, // À activer avec WebSocket ou SSE
    };
  }
}
