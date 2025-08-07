/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Household } from 'src/households/entities/household.entity';
import { Product } from 'src/products/entities/product.entity';
import { StockLog } from 'src/stocks/entities/stock-log.entity';
import { User } from 'src/users/entity/user.entity';
import { IsNull, Repository } from 'typeorm';
import { LoggerService } from '../logger/logger.service';

export interface PlatformStats {
  users: {
    total: number;
    active: number;
    verified: number;
    admins: number;
  };
  households: {
    total: number;
    active: number;
    averageMembers: number;
  };
  products: {
    total: number;
    manual: number;
    fromBarcode: number;
  };
  stocks: {
    totalItems: number;
    expiringSoon: number;
    wasteThisMonth: number;
  };
}

export interface AuditLogFilter {
  userId?: string;
  householdId?: string;
  startDate?: Date;
  endDate?: Date;
  action?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(StockLog)
    private readonly stockLogRepository: Repository<StockLog>,
    private readonly loggerService: LoggerService,
  ) {}

  /**
   * Statistiques générales de la plateforme pour le dashboard admin
   */
  async getPlatformStats(): Promise<PlatformStats> {
    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      adminUsers,
      totalHouseholds,
      totalProducts,
      manualProducts,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { isEmailVerified: true } }),
      this.userRepository
        .createQueryBuilder('user')
        .where(':adminRole = ANY(user.roles)', { adminRole: 'admin' })
        .getCount(),
      this.householdRepository.count(),
      this.productRepository.count(),
      this.productRepository.count({ where: { code: IsNull() } }),
    ]);

    // Calcul de la moyenne de membres par foyer
    const householdMembersAvg = await this.householdRepository
      .createQueryBuilder('household')
      .leftJoin('household.members', 'member')
      .select('AVG(member_count)', 'avgMembers')
      .from((subQuery) => {
        return subQuery
          .select('household.id', 'household_id')
          .addSelect('COUNT(member.id)', 'member_count')
          .from(Household, 'household')
          .leftJoin('household.members', 'member')
          .groupBy('household.id');
      }, 'household_stats')
      .getRawOne();

    // Statistiques des stocks pour le mois en cours
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const wasteThisMonth = await this.stockLogRepository
      .createQueryBuilder('log')
      .select('SUM(log.quantityWasted)', 'totalWasted')
      .where('log.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne();

    this.loggerService.log('Platform stats calculated', 'AuditService');

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        verified: verifiedUsers,
        admins: adminUsers,
      },
      households: {
        total: totalHouseholds,
        active: totalHouseholds, // À affiner avec une logique d'activité
        averageMembers: parseFloat(householdMembersAvg?.avgMembers || '0'),
      },
      products: {
        total: totalProducts,
        manual: manualProducts,
        fromBarcode: totalProducts - manualProducts,
      },
      stocks: {
        totalItems: 0, // À calculer depuis la table stocks
        expiringSoon: 0, // Stocks expirant dans les 7 jours
        wasteThisMonth: parseFloat(wasteThisMonth?.totalWasted || '0'),
      },
    };
  }

  /**
   * Logs d'audit avec filtres avancés
   */
  async getAuditLogs(filters: AuditLogFilter): Promise<{
    logs: StockLog[];
    total: number;
  }> {
    const queryBuilder = this.stockLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('log.stock', 'stock')
      .leftJoinAndSelect('stock.product', 'product')
      .orderBy('log.createdAt', 'DESC');

    // Filtres
    if (filters.userId) {
      queryBuilder.andWhere('user.id = :userId', { userId: filters.userId });
    }

    if (filters.startDate && filters.endDate) {
      queryBuilder.andWhere('log.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters.action) {
      queryBuilder.andWhere('log.action = :action', { action: filters.action });
    }

    // Pagination
    if (filters.limit) {
      queryBuilder.take(filters.limit);
    }
    if (filters.offset) {
      queryBuilder.skip(filters.offset);
    }

    const [logs, total] = await queryBuilder.getManyAndCount();

    this.loggerService.log(
      `Audit logs retrieved: ${logs.length}/${total}`,
      'AuditService',
    );

    return { logs, total };
  }

  /**
   * Activité suspecte - détection d'anomalies
   */
  async getSuspiciousActivity(): Promise<{
    massDeletes: any[];
    unusualUsage: any[];
    failedLogins: any[];
  }> {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Suppressions en masse dans les dernières 24h
    const massDeletes = await this.stockLogRepository
      .createQueryBuilder('log')
      .select('log.userId', 'userId')
      .addSelect('COUNT(*)', 'deleteCount')
      .addSelect('user.email', 'userEmail')
      .leftJoin('log.user', 'user')
      .where('log.action = :action AND log.createdAt >= :since', {
        action: 'DELETE',
        since: last24h,
      })
      .groupBy('log.userId, user.email')
      .having('COUNT(*) > :threshold', { threshold: 10 })
      .getRawMany();

    this.loggerService.log(
      `Suspicious activity check completed`,
      'AuditService',
    );

    return {
      massDeletes,
      unusualUsage: [], // À implémenter selon la logique métier
      failedLogins: [], // À implémenter avec les logs d'auth
    };
  }

  /**
   * Export des données pour compliance/backup
   */
  async exportUserData(userId: string): Promise<{
    user: User | null;
    households: Household[];
    stockLogs: StockLog[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['stocks', 'householdMemberships'],
    });

    if (!user) {
      return {
        user: null,
        households: [],
        stockLogs: [],
      };
    }

    const stockLogs = await this.stockLogRepository.find({
      where: { user: { id: userId } },
      relations: ['stock', 'stock.product'],
    });

    this.loggerService.log(
      `Data export completed for user ${userId}`,
      'AuditService',
    );

    return {
      user,
      households: [], // À récupérer depuis les memberships
      stockLogs,
    };
  }
}
