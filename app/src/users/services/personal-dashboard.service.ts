/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfWeek, startOfWeek, subDays } from 'date-fns';
import { HouseholdMember } from 'src/households/entities/household-member.entity';
import { Household } from 'src/households/entities/household.entity';
import { StockLog } from 'src/stocks/entities/stock-log.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import { StockLogService } from 'src/stocks/services/stock-log.service';
import { Between, Repository } from 'typeorm';
import { User } from '../entity/user.entity';

export interface PersonalOverview {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    isInHouseholds: boolean;
    householdsCount: number;
  };
  currentPeriod: {
    personalStocks: number;
    expiringSoon: number;
    totalPersonalValue: number;
  };
  wasteMetrics: {
    personalWasted: number;
    personalSaved: number;
    personalWasteReduction: number;
  };
  quickActions: string[];
}

export interface PersonalAntiWasteMetrics {
  period: string;
  personal: {
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
  topPersonalWastedProducts: Array<{
    productName: string;
    categoryName: string;
    wastedQuantity: number;
    wastedValue: number;
    trend: number;
  }>;
  personalRecommendations: string[];
}

export interface HouseholdsSummary {
  totalHouseholds: number;
  activeHouseholds: number;
  householdsDetails: Array<{
    id: string;
    name: string;
    role: string;
    membersCount: number;
    lastActivity: Date;
    wasteReduction: number; // %
  }>;
  combinedImpact: {
    totalMembers: number;
    combinedSavings: number;
    combinedCO2Avoided: number;
  };
}

@Injectable()
export class PersonalDashboardService {
  constructor(
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockLog)
    private readonly stockLogRepository: Repository<StockLog>,
    @InjectRepository(HouseholdMember)
    private readonly memberRepository: Repository<HouseholdMember>,
    @InjectRepository(Household)
    private readonly householdRepository: Repository<Household>,
    private readonly stockLogService: StockLogService,
  ) {}

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

  async getPersonalOverview(user: User): Promise<PersonalOverview> {
    // Récupérer les stocks personnels de l'utilisateur
    const personalStocks = await this.stockRepository.find({
      where: { user: { id: user.id } },
      relations: ['product'],
    });

    const expiringSoon = personalStocks.filter(
      (stock) => stock.dlc && stock.dlc <= subDays(new Date(), -3),
    ).length;

    // Récupérer les foyers de l'utilisateur
    const userHouseholds = await this.memberRepository.find({
      where: { userId: user.id, isActive: true },
      relations: ['household'],
    });

    // Métriques de gaspillage personnelles des 30 derniers jours
    const { start, end } = this.getDateRangeForPeriod('30d');
    const personalWasteMetrics = await this.calculatePersonalWasteMetrics(
      user.id,
      start,
      end,
    );

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        isInHouseholds: userHouseholds.length > 0,
        householdsCount: userHouseholds.length,
      },
      currentPeriod: {
        personalStocks: personalStocks.filter((s) => s.quantity > 0).length,
        expiringSoon,
        totalPersonalValue: this.estimateStocksValue(personalStocks),
      },
      wasteMetrics: personalWasteMetrics,
      quickActions: this.generatePersonalQuickActions(
        personalStocks,
        expiringSoon,
        userHouseholds.length,
      ),
    };
  }

  async getPersonalAntiWasteMetrics(
    user: User,
    period: string,
  ): Promise<PersonalAntiWasteMetrics> {
    const { start, end } = this.getDateRangeForPeriod(period);

    // Récupération des logs personnels pour la période
    const personalLogs = await this.stockLogRepository.find({
      where: {
        user: { id: user.id },
        createdAt: Between(start, end),
      },
      relations: ['stock', 'stock.product'],
    });

    const summary = personalLogs.reduce(
      (acc, log) => {
        acc.saved += log.quantitySaved;
        acc.used += log.quantityUsed;
        acc.wasted += log.quantityWasted;
        return acc;
      },
      { saved: 0, used: 0, wasted: 0 },
    );

    // Calcul des top produits gaspillés personnellement
    const productWaste = new Map<string, { name: string; waste: number }>();
    personalLogs.forEach((log) => {
      if (log.quantityWasted > 0 && log.stock?.product) {
        const productId = log.stock.product.id;
        const existing = productWaste.get(productId) || {
          name: log.stock.product.name,
          waste: 0,
        };
        existing.waste += log.quantityWasted;
        productWaste.set(productId, existing);
      }
    });

    const topPersonalWastedProducts = Array.from(productWaste.values())
      .sort((a, b) => b.waste - a.waste)
      .slice(0, 5)
      .map((p) => ({
        productName: p.name,
        categoryName: 'Alimentation',
        wastedQuantity: p.waste,
        wastedValue: p.waste * 2.5,
        trend: -5.2, // À calculer avec période précédente
      }));

    return {
      period,
      personal: {
        totalWasteReduced: summary.saved,
        moneySaved: summary.saved * 2.5,
        co2Avoided: summary.saved * 0.5,
        wasteReductionRate:
          summary.wasted > 0
            ? (summary.saved / (summary.saved + summary.wasted)) * 100
            : 0,
      },
      breakdown: summary,
      topPersonalWastedProducts,
      personalRecommendations: this.generatePersonalRecommendations(
        topPersonalWastedProducts,
      ),
    };
  }

  async getPersonalEnvironmentalImpact(user: User, period: string) {
    const antiWasteMetrics = await this.getPersonalAntiWasteMetrics(
      user,
      period,
    );
    const totalSaved = antiWasteMetrics.personal.totalWasteReduced;

    // Récupérer la position de l'utilisateur parmi tous les utilisateurs
    const allUsers = await this.stockLogRepository
      .createQueryBuilder('log')
      .select('log.userId')
      .addSelect('SUM(log.quantitySaved)', 'totalSaved')
      .groupBy('log.userId')
      .orderBy('totalSaved', 'DESC')
      .getRawMany();

    const userRank = allUsers.findIndex((u) => u.log_userId === user.id) + 1;

    return {
      personal: {
        co2Savings: {
          total: totalSaved * 0.5,
          equivalent: `${Math.round(totalSaved * 0.5 * 4.6)} km en voiture évités`,
        },
        waterSavings: {
          total: totalSaved * 1000,
          equivalent: `${Math.round((totalSaved * 1000) / 200)} douches économisées`,
        },
        energySavings: {
          total: totalSaved * 2.5,
          equivalent: `${Math.round((totalSaved * 2.5) / 0.1)} heures d'éclairage LED`,
        },
      },
      comparison: {
        vsAverageUser: 15, // % meilleur que la moyenne
        personalRanking: userRank || 999,
        totalUsers: allUsers.length,
      },
    };
  }

  async getPersonalSavingsReport(user: User, period: string) {
    const antiWasteMetrics = await this.getPersonalAntiWasteMetrics(
      user,
      period,
    );

    return {
      period,
      personal: {
        totalSavings: antiWasteMetrics.personal.moneySaved,
        breakdown: {
          foodSaved: antiWasteMetrics.personal.moneySaved * 0.8,
          energySaved: antiWasteMetrics.personal.moneySaved * 0.1,
          waterSaved: antiWasteMetrics.personal.moneySaved * 0.1,
        },
        projection: {
          monthly:
            antiWasteMetrics.personal.moneySaved *
            (30 / this.getDaysInPeriod(period)),
          yearly:
            antiWasteMetrics.personal.moneySaved *
            (365 / this.getDaysInPeriod(period)),
        },
      },
      comparison: {
        previousPeriod: +12.5, // % d'amélioration
        averageUser: +18.7,
      },
    };
  }

  async getPersonalWasteTrends(user: User, compareWith: string) {
    // Données actuelles (30 derniers jours)
    const current = await this.getPersonalAntiWasteMetrics(user, '30d');

    // Données de comparaison
    let comparison;
    if (compareWith === 'previous_period') {
      const { start: prevStart, end: prevEnd } = {
        start: subDays(new Date(), 60),
        end: subDays(new Date(), 30),
      };
      comparison = await this.calculatePersonalWasteMetrics(
        user.id,
        prevStart,
        prevEnd,
      );
    }

    return {
      personal: {
        current: {
          period: '30d',
          wasted: current.breakdown.wasted,
          saved: current.breakdown.saved,
        },
        comparison: {
          period: 'previous_30d',
          wasted: comparison?.personalWasted || 0,
          saved: comparison?.personalSaved || 0,
        },
        trends: {
          wasteReduction: comparison
            ? ((comparison.personalWasted - current.breakdown.wasted) /
                comparison.personalWasted) *
              100
            : 0,
          savingsIncrease: comparison
            ? ((current.breakdown.saved - comparison.personalSaved) /
                comparison.personalSaved) *
              100
            : 0,
        },
      },
      insights: [
        'Votre gaspillage personnel a diminué de 12% ce mois-ci',
        'Vous économisez mieux les légumes',
        'Continuez vos efforts sur les produits laitiers',
      ],
    };
  }

  async getPersonalProductsWasteAnalysis(user: User, period: string) {
    const antiWasteMetrics = await this.getPersonalAntiWasteMetrics(
      user,
      period,
    );

    return {
      period,
      personal: {
        categories: [
          {
            name: 'Légumes',
            wastedQuantity: 5.2,
            wastedValue: 12.8,
            savedQuantity: 4.1,
            personalRecommendations: [
              'Stockez au réfrigérateur',
              'Utilisez pour des soupes',
            ],
          },
          {
            name: 'Fruits',
            wastedQuantity: 3.4,
            wastedValue: 8.5,
            savedQuantity: 6.7,
            personalRecommendations: [
              'Séparez les bananes',
              'Congelez pour smoothies',
            ],
          },
        ],
        topPerformers: antiWasteMetrics.topPersonalWastedProducts.slice(0, 3),
        improvementAreas: antiWasteMetrics.topPersonalWastedProducts.slice(-3),
      },
    };
  }

  async getPersonalAchievements(user: User) {
    const metrics = await this.getPersonalAntiWasteMetrics(user, '30d');

    return {
      personal: {
        unlockedBadges: [
          {
            id: 'personal_eco_warrior',
            name: 'Éco-Guerrier Solo',
            description: 'Réduction personnelle du gaspillage de plus de 40%',
            unlockedAt: new Date(),
            icon: '🌟',
          },
          {
            id: 'smart_shopper',
            name: 'Acheteur Malin',
            description: '5kg de nourriture économisés en un mois',
            unlockedAt: subDays(new Date(), 3),
            icon: '🛒',
          },
        ],
        progress: [
          {
            id: 'zero_waste_master',
            name: 'Maître Zéro Déchet',
            description: "Atteindre 50kg d'économies en un an",
            progress: 32,
            target: 50,
            icon: '♻️',
          },
        ],
        nextPersonalGoals: [
          'Réduire le gaspillage de pain de 30%',
          'Économiser 20€ ce mois',
          'Débloquer le badge "Minimaliste Alimentaire"',
        ],
      },
    };
  }

  async getPersonalWeeklySummary(user: User, week?: number, year?: number) {
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

    const personalWeeklyStats = await this.stockLogService.getWeeklyStats(
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
      personal: {
        stats: personalWeeklyStats,
        highlights: [
          'Semaine productive !',
          '18% moins de gaspillage que la semaine dernière',
          '2 nouveaux produits économisés',
        ],
        personalRecommendations: [
          'Excellent travail cette semaine !',
          'Attention aux yaourts qui expirent demain',
          'Planifiez vos repas pour la semaine prochaine',
        ],
      },
    };
  }

  getPersonalAntiWasteChallenges(user: User) {
    return {
      personal: {
        activeChallenges: [
          {
            id: 'solo_zero_waste_week',
            name: 'Semaine Solo Zéro Déchet',
            description: 'Aucun gaspillage personnel pendant 7 jours',
            progress: 3,
            target: 7,
            reward: 'Badge "Perfectionniste Solo"',
            endsAt: endOfWeek(new Date()),
          },
        ],
        availableChallenges: [
          {
            id: 'personal_veggie_master',
            name: 'Maître des Légumes',
            description: 'Économisez 1kg de légumes ce mois',
            difficulty: 'Moyen',
            reward: '15 points verts',
          },
        ],
        completedChallenges: [
          {
            id: 'first_personal_save',
            name: 'Premier Sauvetage Solo',
            completedAt: subDays(new Date(), 8),
            reward: 'Badge "Débutant Éco"',
          },
        ],
      },
    };
  }

  async getUserHouseholdsSummary(user: User): Promise<HouseholdsSummary> {
    const userMemberships = await this.memberRepository.find({
      where: { userId: user.id, isActive: true },
      relations: ['household', 'household.members'],
    });

    if (userMemberships.length === 0) {
      return {
        totalHouseholds: 0,
        activeHouseholds: 0,
        householdsDetails: [],
        combinedImpact: {
          totalMembers: 0,
          combinedSavings: 0,
          combinedCO2Avoided: 0,
        },
      };
    }

    const householdsDetails = await Promise.all(
      userMemberships.map((membership) => {
        // Calculer les métriques du foyer (simplifié)
        return {
          id: membership.household.id,
          name: membership.household.name,
          role: membership.role,
          membersCount: membership.household.members.filter((m) => m.isActive)
            .length,
          lastActivity: new Date(), // À calculer depuis les logs
          wasteReduction: 23, // % à calculer
        };
      }),
    );

    return {
      totalHouseholds: userMemberships.length,
      activeHouseholds: userMemberships.length,
      householdsDetails,
      combinedImpact: {
        totalMembers: householdsDetails.reduce(
          (acc, h) => acc + h.membersCount,
          0,
        ),
        combinedSavings: 145.5, // À calculer réellement
        combinedCO2Avoided: 12.8, // À calculer réellement
      },
    };
  }

  async getGlobalUserStats(user: User, period: string) {
    const personalStats = await this.getPersonalAntiWasteMetrics(user, period);
    const householdsSummary = await this.getUserHouseholdsSummary(user);

    return {
      period,
      combined: {
        personal: personalStats.personal,
        households: householdsSummary.combinedImpact,
        total: {
          totalSavings:
            personalStats.personal.moneySaved +
            householdsSummary.combinedImpact.combinedSavings,
          totalCO2Avoided:
            personalStats.personal.co2Avoided +
            householdsSummary.combinedImpact.combinedCO2Avoided,
        },
      },
      breakdown: {
        personalContribution: {
          percentage:
            personalStats.personal.moneySaved > 0
              ? (personalStats.personal.moneySaved /
                  (personalStats.personal.moneySaved +
                    householdsSummary.combinedImpact.combinedSavings)) *
                100
              : 0,
          amount: personalStats.personal.moneySaved,
        },
        householdsContribution: {
          percentage:
            householdsSummary.combinedImpact.combinedSavings > 0
              ? (householdsSummary.combinedImpact.combinedSavings /
                  (personalStats.personal.moneySaved +
                    householdsSummary.combinedImpact.combinedSavings)) *
                100
              : 0,
          amount: householdsSummary.combinedImpact.combinedSavings,
        },
      },
      insights: [
        householdsSummary.totalHouseholds > 0
          ? `Vous contribuez à ${householdsSummary.totalHouseholds} foyer(s)`
          : 'Vous êtes un utilisateur solo - excellent travail !',
        'Vos efforts personnels représentent 65% de vos économies',
        'Impact combiné exceptionnel ce mois-ci',
      ],
    };
  }

  // Méthodes utilitaires privées
  private async calculatePersonalWasteMetrics(
    userId: string,
    start: Date,
    end: Date,
  ) {
    const logs = await this.stockLogRepository.find({
      where: {
        user: { id: userId },
        createdAt: Between(start, end),
      },
    });

    return logs.reduce(
      (acc, log) => {
        acc.personalWasted += log.quantityWasted;
        acc.personalSaved += log.quantitySaved;
        return acc;
      },
      { personalWasted: 0, personalSaved: 0, personalWasteReduction: 0 },
    );
  }

  private estimateStocksValue(stocks: Stock[]): number {
    return stocks.reduce((total, stock) => total + stock.quantity * 2.5, 0);
  }

  private generatePersonalQuickActions(
    stocks: Stock[],
    expiringSoon: number,
    householdsCount: number,
  ): string[] {
    const actions: string[] = [];

    if (expiringSoon > 0) {
      actions.push(`${expiringSoon} de vos produits expirent bientôt`);
    }

    if (stocks.length > 20) {
      actions.push('Beaucoup de stocks personnels - planifiez vos repas');
    }

    if (householdsCount === 0) {
      actions.push('Créer ou rejoindre un foyer');
    } else {
      actions.push(`Vous participez à ${householdsCount} foyer(s)`);
    }

    actions.push('Ajouter un nouveau stock');
    return actions;
  }

  private generatePersonalRecommendations(topWasted: any[]): string[] {
    const recommendations = [
      "Planifiez vos repas personnels à l'avance",
      'Vérifiez vos dates de péremption chaque matin',
      'Utilisez vos restes créativement',
    ];

    if (topWasted.length > 0) {
      recommendations.unshift(
        `Attention à vos ${topWasted[0].productName} - souvent gaspillés`,
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
