import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { endOfWeek, startOfWeek, subWeeks } from 'date-fns';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/users/entity/user.entity';
import { StockLogService } from '../services/stock-log.service';

class WeeklyStatsQuery {
  week?: number;
  year?: number;
}

@Controller('stocks/logs')
@UseGuards(AuthGuard('jwt'))
export class StockLogController {
  constructor(private readonly stockLogService: StockLogService) {}

  @Get('weekly-stats')
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
        stock: {
          id: log.stock.id,
          product: {
            id: log.stock.product.id,
            name: log.stock.product.name,
          },
          quantity: Number(log.stock.quantity),
          dlc: log.stock.dlc,
        },
      })),
    };
  }

  @Get('current-week')
  async getCurrentWeekStats(@CurrentUser() user: User) {
    const now = new Date();
    const startDate = startOfWeek(now, { weekStartsOn: 1 });
    const endDate = endOfWeek(now, { weekStartsOn: 1 });

    return this.stockLogService.getWeeklyStats(user.id, startDate, endDate);
  }

  @Get('last-week')
  async getLastWeekStats(@CurrentUser() user: User) {
    const now = new Date();
    const lastWeek = subWeeks(now, 1);
    const startDate = startOfWeek(lastWeek, { weekStartsOn: 1 });
    const endDate = endOfWeek(lastWeek, { weekStartsOn: 1 });

    return this.stockLogService.getWeeklyStats(user.id, startDate, endDate);
  }

  @Get('overall-stats')
  async getOverallStats(@CurrentUser() user: User) {
    return this.stockLogService.getUserStats(user.id);
  }
}
