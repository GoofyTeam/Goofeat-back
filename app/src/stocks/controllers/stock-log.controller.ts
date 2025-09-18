import {
  Controller,
  Get,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { endOfWeek, startOfWeek, subWeeks } from 'date-fns';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/users/entity/user.entity';
import { StockLogService } from '../services/stock-log.service';

class WeeklyStatsQuery {
  week?: number;

  year?: number;
}

@ApiTags('Stocks - Logs')
@ApiBearerAuth()
@Controller('stocks/logs')
@UseGuards(AuthGuard('jwt'))
export class StockLogController {
  constructor(private readonly stockLogService: StockLogService) {}

  @Get('weekly-stats')
  @ApiOperation({
    summary: 'Obtenir les statistiques hebdomadaires des stocks',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques hebdomadaires récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        week: { type: 'number', example: 42 },
        year: { type: 'number', example: 2024 },
        period: {
          type: 'object',
          properties: {
            start: { type: 'string', format: 'date-time' },
            end: { type: 'string', format: 'date-time' },
          },
        },
        stats: {
          type: 'object',
          properties: {
            totalUsed: { type: 'number', example: 5.5 },
            totalWasted: { type: 'number', example: 1.2 },
            totalSaved: { type: 'number', example: 3.3 },
          },
        },
        logs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              action: { type: 'string', enum: ['used', 'wasted', 'expired'] },
              quantityUsed: { type: 'number' },
              quantityWasted: { type: 'number' },
              quantitySaved: { type: 'number' },
              reason: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              stock: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  product: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                    },
                  },
                  quantity: { type: 'number' },
                  dlc: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiQuery({
    name: 'week',
    description: 'Numéro de la semaine (1-52)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'year',
    description: 'Année',
    required: false,
    type: Number,
  })
  async getWeeklyStats(
    @CurrentUser() user: User,
    @Query(new ValidationPipe({ transform: true })) query: WeeklyStatsQuery,
  ) {
    let startDate: Date;
    let endDate: Date;

    if (query.week && query.year) {
      // Si semaine et année spécifiées
      const firstDayOfYear = new Date(query.year, 0, 1);
      const days = (query.week - 1) * 7;
      startDate = new Date(
        firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000,
      );
      startDate = startOfWeek(startDate, { weekStartsOn: 1 });
      endDate = endOfWeek(startDate, { weekStartsOn: 1 });
    } else {
      // Semaine courante par défaut
      const now = new Date();
      startDate = startOfWeek(now, { weekStartsOn: 1 });
      endDate = endOfWeek(now, { weekStartsOn: 1 });
    }

    const stats = await this.stockLogService.getWeeklyStats(
      user.id,
      startDate,
      endDate,
    );

    const now = new Date();
    const currentWeek = Math.ceil(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );

    return {
      week: query.week || currentWeek,
      year: query.year || now.getFullYear(),
      period: {
        start: startDate,
        end: endDate,
      },
      stats: {
        totalUsed: Number(stats.totalUsed),
        totalWasted: Number(stats.totalWasted),
        totalSaved: Number(stats.totalSaved),
      },
      logs: stats.logs.map((log) => ({
        id: log.id,
        action: log.action,
        quantityUsed: Number(log.quantityUsed),
        quantityWasted: Number(log.quantityWasted),
        quantitySaved: Number(log.quantitySaved),
        reason: log.reason,
        createdAt: log.createdAt,
        stock: log.stock
          ? {
              id: log.stock.id,
              product: {
                id: log.stock.product.id,
                name: log.stock.product.name,
              },
              quantity: Number(log.stock.quantity),
              dlc: log.stock.dlc,
            }
          : {
              id: log.stockId || 'deleted',
              product: {
                id: log.stockId || 'deleted',
                name: log.productName || 'Produit supprimé',
              },
              quantity: Number(log.quantityBefore),
              dlc: log.dlcBefore,
            },
      })),
    };
  }

  @Get('current-week')
  @ApiOperation({ summary: 'Obtenir les statistiques de la semaine courante' })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de la semaine courante récupérées avec succès',
  })
  async getCurrentWeekStats(@CurrentUser() user: User) {
    const now = new Date();
    const startDate = startOfWeek(now, { weekStartsOn: 1 });
    const endDate = endOfWeek(now, { weekStartsOn: 1 });

    return this.stockLogService.getWeeklyStats(user.id, startDate, endDate);
  }

  @Get('last-week')
  @ApiOperation({
    summary: 'Obtenir les statistiques de la semaine précédente',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques de la semaine précédente récupérées avec succès',
  })
  async getLastWeekStats(@CurrentUser() user: User) {
    const now = new Date();
    const lastWeek = subWeeks(now, 1);
    const startDate = startOfWeek(lastWeek, { weekStartsOn: 1 });
    const endDate = endOfWeek(lastWeek, { weekStartsOn: 1 });

    return this.stockLogService.getWeeklyStats(user.id, startDate, endDate);
  }

  @Get('overall-stats')
  @ApiOperation({
    summary: "Obtenir les statistiques globales de l'utilisateur",
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques globales récupérées avec succès',
  })
  async getOverallStats(@CurrentUser() user: User) {
    return this.stockLogService.getUserStats(user.id);
  }
}
