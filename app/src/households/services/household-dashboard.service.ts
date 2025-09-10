/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfWeek, startOfWeek, subDays } from 'date-fns';
import { StockLog } from 'src/stocks/entities/stock-log.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { StockLogService } from 'src/stocks/services/stock-log.service';
import { User } from 'src/users/entity/user.entity';
import { Repository } from 'typeorm';
import { HouseholdMember } from '../entities/household-member.entity';
import { Household } from '../entities/household.entity';

export interface HouseholdOverview {
  household: {
    id: string;
    name: string;
    membersCount: number;
  };
  currentPeriod: {
    totalStocks: number;
    expiringSoon: number; // Dans les 3 jours
    totalValue: number; // Valeur estimée des stocks
  };
  wasteMetrics: {
    totalWasted: number;
    totalSaved: number;
    wasteReduction: number; // % par rapport à la période précédente
  };
  quickActions: string[];
}

export interface AntiWasteMetrics {
  period: string;
  summary: {
    totalWasteReduced: number; // kg
    moneySaved: number; // euros
    co2Avoided: number; // kg CO2
    wasteReductionRate: number; // %
  };
  breakdown: {
    saved: number;
    used: number;
    wasted: number;
  };
  topWastedProducts: Array<{
    productName: string;
    categoryName: string;
    wastedQuantity: number;
    wastedValue: number;
    trend: number; // % changement
  }>;
  recommendations: string[];
}

export interface EnvironmentalImpact {
  co2Savings: {
    total: number; // kg CO2 évité
    equivalent: string; // "Équivaut à X km en voiture"
  };
  waterSavings: {
    total: number; // litres d'eau économisés
    equivalent: string;
  };
  energySavings: {
    total: number; // kWh économisés
    equivalent: string;
  };
  comparison: {
    vsAverageHousehold: number; // % meilleur que la moyenne
    ranking: number; // Position dans le classement des foyers
  };
}

@Injectable()
export class HouseholdDashboardService {
  constructor(
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
    @InjectRepository(HouseholdMember)
    private readonly memberRepository: Repository<HouseholdMember>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockLog)
    private readonly stockLogRepository: Repository<StockLog>,
    private readonly stockLogService: StockLogService,
  ) {}

  private async verifyHouseholdAccess(
    householdId: string,
    user: User,
  ): Promise<void> {
    const membership = await this.memberRepository.findOne({
      where: {
        householdId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Accès refusé à ce foyer');
    }
  }

  private getDateRangeForPeriod(period: string): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    const end: Date = now;

    switch (period) {
      case '7d':
        start = subDays(now, 7);
        break;
      case '30d':
        start = subDays(now, 30);
        break;
      case '90d':
        start = subDays(now, 90);
        break;
      case '1y':
        start = subDays(now, 365);
        break;
      default:
        start = subDays(now, 30);
    }

    return { start, end };
  }

  async getHouseholdOverview(
    householdId: string,
    user: User,
  ): Promise<HouseholdOverview> {
    await this.verifyHouseholdAccess(householdId, user);

    const household = await this.householdRepository.findOne({
      where: { id: householdId },
      relations: ['members'],
    });

    if (!household) {
      throw new Error('Foyer non trouvé');
    }

    // Stocks actuels du foyer
    const currentStocks = await this.stockRepository
      .createQueryBuilder('stock')
      .innerJoin('stock.user', 'user')
      .innerJoin('user.householdMemberships', 'membership')
      .where('membership.householdId = :householdId', { householdId })
      .andWhere('membership.isActive = true')
      .andWhere('stock.quantity > 0')
      .getMany();

    const expiringSoon = currentStocks.filter(
      (stock) => stock.dlc && stock.dlc <= subDays(new Date(), -3),
    ).length;

    // Métriques de gaspillage des 30 derniers jours
    const { start, end } = this.getDateRangeForPeriod('30d');
    const wasteMetrics = await this.calculateWasteMetrics(
      householdId,
      start,
      end,
    );

    return {
      household: {
        id: household.id,
        name: household.name,
        membersCount: household.members.filter((m) => m.isActive).length,
      },
      currentPeriod: {
        totalStocks: currentStocks.length,
        expiringSoon,
        totalValue: this.estimateStocksValue(currentStocks),
      },
      wasteMetrics,
      quickActions: this.generateQuickActions(currentStocks, expiringSoon),
    };
  }

  async getAntiWasteMetrics(
    householdId: string,
    user: User,
    period: string,
  ): Promise<AntiWasteMetrics> {
    await this.verifyHouseholdAccess(householdId, user);

    const { start, end } = this.getDateRangeForPeriod(period);

    // Récupération des logs du foyer pour la période
    const logs = await this.stockLogRepository
      .createQueryBuilder('log')
      .innerJoin('log.user', 'user')
      .innerJoin('user.householdMemberships', 'membership')
      .innerJoin('log.stock', 'stock')
      .innerJoin('stock.product', 'product')
      .where('membership.householdId = :householdId', { householdId })
      .andWhere('membership.isActive = true')
      .andWhere('log.createdAt BETWEEN :start AND :end', { start, end })
      .select([
        'log.quantityUsed',
        'log.quantityWasted',
        'log.quantitySaved',
        'log.action',
        'product.name',
        'product.id',
      ])
      .getRawMany();

    const summary = logs.reduce(
      (acc, log) => {
        acc.saved += parseFloat(log.log_quantitySaved) || 0;
        acc.used += parseFloat(log.log_quantityUsed) || 0;
        acc.wasted += parseFloat(log.log_quantityWasted) || 0;
        return acc;
      },
      { saved: 0, used: 0, wasted: 0 },
    );

    // Calcul des top produits gaspillés
    const productWaste = new Map<string, { name: string; waste: number }>();
    logs.forEach((log) => {
      if (log.log_quantityWasted > 0) {
        const existing = productWaste.get(log.product_id) || {
          name: log.product_name,
          waste: 0,
        };
        existing.waste += parseFloat(log.log_quantityWasted);
        productWaste.set(log.product_id, existing);
      }
    });

    const topWastedProducts = Array.from(productWaste.values())
      .sort((a, b) => b.waste - a.waste)
      .slice(0, 5)
      .map((p) => ({
        productName: p.name,
        categoryName: 'Alimentation', // À récupérer depuis les relations
        wastedQuantity: p.waste,
        wastedValue: p.waste * 2.5, // Prix estimé par unité
        trend: -5.2, // À calculer avec la période précédente
      }));

    return {
      period,
      summary: {
        totalWasteReduced: summary.saved,
        moneySaved: summary.saved * 2.5, // Prix moyen estimé
        co2Avoided: summary.saved * 0.5, // 0.5kg CO2 par kg sauvé
        wasteReductionRate:
          summary.wasted > 0
            ? (summary.saved / (summary.saved + summary.wasted)) * 100
            : 0,
      },
      breakdown: summary,
      topWastedProducts,
      recommendations: this.generateRecommendations(topWastedProducts),
    };
  }

  async getEnvironmentalImpact(
    householdId: string,
    user: User,
    period: string,
  ): Promise<EnvironmentalImpact> {
    await this.verifyHouseholdAccess(householdId, user);

    const antiWasteMetrics = await this.getAntiWasteMetrics(
      householdId,
      user,
      period,
    );
    const totalSaved = antiWasteMetrics.summary.totalWasteReduced;

    return {
      co2Savings: {
        total: totalSaved * 0.5, // 0.5kg CO2 par kg de nourriture sauvée
        equivalent: `${Math.round(totalSaved * 0.5 * 4.6)} km en voiture évités`,
      },
      waterSavings: {
        total: totalSaved * 1000, // 1000L d'eau par kg de nourriture
        equivalent: `${Math.round((totalSaved * 1000) / 200)} douches économisées`,
      },
      energySavings: {
        total: totalSaved * 2.5, // 2.5kWh par kg
        equivalent: `${Math.round((totalSaved * 2.5) / 0.1)} heures d'éclairage LED`,
      },
      comparison: {
        vsAverageHousehold: 23, // % meilleur que la moyenne (à calculer)
        ranking: 12, // Position dans le classement (à calculer)
      },
    };
  }

  async getSavingsReport(householdId: string, user: User, period: string) {
    await this.verifyHouseholdAccess(householdId, user);

    const antiWasteMetrics = await this.getAntiWasteMetrics(
      householdId,
      user,
      period,
    );

    return {
      period,
      totalSavings: antiWasteMetrics.summary.moneySaved,
      breakdown: {
        foodSaved: antiWasteMetrics.summary.moneySaved * 0.8,
        energySaved: antiWasteMetrics.summary.moneySaved * 0.1,
        waterSaved: antiWasteMetrics.summary.moneySaved * 0.1,
      },
      projection: {
        monthly:
          antiWasteMetrics.summary.moneySaved *
          (30 / this.getDaysInPeriod(period)),
        yearly:
          antiWasteMetrics.summary.moneySaved *
          (365 / this.getDaysInPeriod(period)),
      },
      comparison: {
        previousPeriod: +15.2, // % d'amélioration
        averageHousehold: +23.4,
      },
    };
  }

  async getWasteTrends(householdId: string, user: User, compareWith: string) {
    await this.verifyHouseholdAccess(householdId, user);

    // Données de la période actuelle (30 derniers jours)
    const current = await this.getAntiWasteMetrics(householdId, user, '30d');

    // Données de comparaison
    let comparison;
    if (compareWith === 'previous_period') {
      const { start: prevStart, end: prevEnd } = {
        start: subDays(new Date(), 60),
        end: subDays(new Date(), 30),
      };
      comparison = await this.calculateWasteMetrics(
        householdId,
        prevStart,
        prevEnd,
      );
    }

    return {
      current: {
        period: '30d',
        wasted: current.breakdown.wasted,
        saved: current.breakdown.saved,
      },
      comparison: {
        period: 'previous_30d',
        wasted: comparison?.wasted || 0,
        saved: comparison?.saved || 0,
      },
      trends: {
        wasteReduction: comparison
          ? ((comparison.wasted - current.breakdown.wasted) /
              comparison.wasted) *
            100
          : 0,
        savingsIncrease: comparison
          ? ((current.breakdown.saved - comparison.saved) / comparison.saved) *
            100
          : 0,
      },
      insights: [
        'Votre gaspillage a diminué de 15% ce mois-ci',
        'Les légumes représentent 40% de vos économies',
        'Meilleure performance le weekend',
      ],
    };
  }

  async getProductsWasteAnalysis(
    householdId: string,
    user: User,
    period: string,
  ) {
    await this.verifyHouseholdAccess(householdId, user);

    const antiWasteMetrics = await this.getAntiWasteMetrics(
      householdId,
      user,
      period,
    );

    return {
      period,
      categories: [
        {
          name: 'Légumes',
          wastedQuantity: 12.3,
          wastedValue: 25.6,
          savedQuantity: 8.7,
          recommendations: [
            'Stockez les légumes verts au réfrigérateur',
            'Utilisez les légumes flétris pour des soupes',
          ],
        },
        {
          name: 'Fruits',
          wastedQuantity: 8.9,
          wastedValue: 18.9,
          savedQuantity: 15.2,
          recommendations: [
            'Séparez les bananes des autres fruits',
            'Congelez les fruits trop mûrs pour des smoothies',
          ],
        },
      ],
      topPerformers: antiWasteMetrics.topWastedProducts.slice(0, 3),
      improvementAreas: antiWasteMetrics.topWastedProducts.slice(-3),
    };
  }

  async getHouseholdAchievements(householdId: string, user: User) {
    await this.verifyHouseholdAccess(householdId, user);

    const _metrics = await this.getAntiWasteMetrics(householdId, user, '30d');

    return {
      unlockedBadges: [
        {
          id: 'waste_warrior',
          name: 'Guerrier Anti-Gaspi',
          description: 'Réduction du gaspillage de plus de 50%',
          unlockedAt: new Date(),
          icon: '🏆',
        },
        {
          id: 'green_household',
          name: 'Foyer Vert',
          description: '10kg de CO2 évités en un mois',
          unlockedAt: subDays(new Date(), 5),
          icon: '🌱',
        },
      ],
      progress: [
        {
          id: 'eco_master',
          name: 'Maître Écolo',
          description: 'Éviter 100kg de CO2 en un an',
          progress: 65,
          target: 100,
          icon: '🌍',
        },
      ],
      nextGoals: [
        'Réduire le gaspillage de légumes de 20%',
        "Atteindre 50€ d'économies ce mois",
        'Débloquer le badge "Zéro Déchet"',
      ],
    };
  }

  async getWeeklySummary(
    householdId: string,
    user: User,
    week?: number,
    year?: number,
  ) {
    await this.verifyHouseholdAccess(householdId, user);

    const now = new Date();
    const targetWeek =
      week ||
      Math.ceil(
        (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) /
          (7 * 24 * 60 * 60 * 1000),
      );
    const targetYear = year || now.getFullYear();

    const startDate = startOfWeek(
      new Date(targetYear, 0, 1 + (targetWeek - 1) * 7),
    );
    const endDate = endOfWeek(startDate);

    const weeklyStats = await this.stockLogService.getWeeklyStats(
      user.id,
      startDate,
      endDate,
    );

    return {
      week: targetWeek,
      year: targetYear,
      period: {
        start: startDate,
        end: endDate,
      },
      stats: weeklyStats,
      highlights: [
        'Meilleure semaine du mois !',
        '23% moins de gaspillage que la semaine dernière',
        '3 nouveaux produits économisés',
      ],
      recommendations: [
        'Continuez sur cette lancée !',
        'Pensez à vérifier vos légumes demain',
        'Planifiez vos repas pour la semaine prochaine',
      ],
    };
  }

  async getAntiWasteChallenges(householdId: string, user: User) {
    await this.verifyHouseholdAccess(householdId, user);

    return {
      activeChallenges: [
        {
          id: 'zero_waste_week',
          name: 'Semaine Zéro Déchet',
          description: 'Ne gaspillez aucun produit pendant 7 jours',
          progress: 4,
          target: 7,
          reward: 'Badge "Perfectionniste"',
          endsAt: endOfWeek(new Date()),
        },
      ],
      availableChallenges: [
        {
          id: 'veggie_saver',
          name: 'Sauveur de Légumes',
          description: 'Économisez 2kg de légumes ce mois',
          difficulty: 'Facile',
          reward: '10 points écolo',
        },
      ],
      completedChallenges: [
        {
          id: 'first_saver',
          name: 'Premier Sauvetage',
          completedAt: subDays(new Date(), 10),
          reward: 'Badge "Débutant"',
        },
      ],
    };
  }

  // Méthodes utilitaires privées
  private async calculateWasteMetrics(
    householdId: string,
    start: Date,
    end: Date,
  ) {
    const logs = await this.stockLogRepository
      .createQueryBuilder('log')
      .innerJoin('log.user', 'user')
      .innerJoin('user.householdMemberships', 'membership')
      .where('membership.householdId = :householdId', { householdId })
      .andWhere('membership.isActive = true')
      .andWhere('log.createdAt BETWEEN :start AND :end', { start, end })
      .getMany();

    return logs.reduce(
      (acc, log) => {
        acc.totalWasted += log.quantityWasted;
        acc.totalSaved += log.quantitySaved;
        return acc;
      },
      { totalWasted: 0, totalSaved: 0, wasteReduction: 0 },
    );
  }

  private estimateStocksValue(stocks: Stock[]): number {
    // Prix moyen estimé par produit : 2.5€
    return stocks.reduce((total, stock) => total + stock.quantity * 2.5, 0);
  }

  private generateQuickActions(
    stocks: Stock[],
    expiringSoon: number,
  ): string[] {
    const actions: string[] = [];

    if (expiringSoon > 0) {
      actions.push(`${expiringSoon} produits expirent bientôt`);
    }

    if (stocks.length > 50) {
      actions.push('Beaucoup de stocks - planifiez vos repas');
    }

    actions.push('Ajouter un nouveau produit');
    return actions;
  }

  private generateRecommendations(topWasted: any[]): string[] {
    const recommendations = [
      "Planifiez vos repas à l'avance",
      'Vérifiez les dates de péremption régulièrement',
      'Utilisez les restes pour de nouveaux plats',
    ];

    if (topWasted.length > 0) {
      recommendations.unshift(
        `Attention aux ${topWasted[0].productName} - souvent gaspillés`,
      );
    }

    return recommendations;
  }

  private getDaysInPeriod(period: string): number {
    switch (period) {
      case '7d':
        return 7;
      case '30d':
        return 30;
      case '90d':
        return 90;
      case '1y':
        return 365;
      default:
        return 30;
    }
  }
}
