import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { User } from '../../users/entity/user.entity';
import { StockLog, StockLogAction } from '../entities/stock-log.entity';
import { Stock } from '../entities/stock.entity';

export interface CreateStockLogDto {
  stock?: Stock;
  stockId?: string;
  productName?: string;
  productUnit?: string;
  user: User;
  action: StockLogAction;
  quantityBefore: number;
  quantityAfter: number;
  quantityUsed?: number;
  quantityWasted?: number;
  quantitySaved?: number;
  dlcBefore?: Date;
  dlcAfter?: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class StockLogService {
  private readonly logger = new Logger(StockLogService.name);

  constructor(
    @InjectRepository(StockLog)
    private readonly stockLogRepository: Repository<StockLog>,
  ) {}

  async createLog(logData: CreateStockLogDto): Promise<StockLog> {
    const log = this.stockLogRepository.create({
      stock: logData.stock,
      stockId: logData.stockId,
      productName: logData.productName,
      productUnit: logData.productUnit,
      user: logData.user,
      action: logData.action,
      quantityBefore: logData.quantityBefore,
      quantityAfter: logData.quantityAfter,
      quantityUsed: logData.quantityUsed || 0,
      quantityWasted: logData.quantityWasted || 0,
      quantitySaved: logData.quantitySaved || 0,
      dlcBefore: logData.dlcBefore,
      dlcAfter: logData.dlcAfter,
      reason: logData.reason,
      metadata: logData.metadata,
    });

    return this.stockLogRepository.save(log);
  }

  async logStockCreation(
    stock: Stock,
    user: User,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    return this.createLog({
      stock,
      user,
      action: StockLogAction.CREATE,
      quantityBefore: 0,
      quantityAfter: stock.quantity,
      dlcAfter: stock.dlc,
      metadata,
    });
  }

  async logStockUpdate(
    stock: Stock,
    user: User,
    oldQuantity: number,
    oldDlc?: Date,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    const quantityDiff = stock.quantity - oldQuantity;
    const quantityUsed = quantityDiff < 0 ? Math.abs(quantityDiff) : 0;
    const quantitySaved = quantityDiff > 0 ? quantityDiff : 0;

    return this.createLog({
      stock,
      user,
      action: StockLogAction.UPDATE,
      quantityBefore: oldQuantity,
      quantityAfter: stock.quantity,
      quantityUsed,
      quantitySaved,
      dlcBefore: oldDlc,
      dlcAfter: stock.dlc,
      metadata,
    });
  }

  async logStockDeletion(
    stock: Stock,
    user: User,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    return this.createLog({
      stockId: stock.id,
      productName: stock.product?.name,
      productUnit: stock.unit,
      user,
      action: StockLogAction.DELETE,
      quantityBefore: stock.quantity,
      quantityAfter: 0,
      quantityWasted: stock.quantity,
      dlcBefore: stock.dlc,
      reason,
      metadata,
    });
  }

  async logStockUsage(
    stock: Stock,
    user: User,
    quantityUsed: number,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    return this.createLog({
      stock,
      user,
      action: StockLogAction.USE,
      quantityBefore: stock.quantity + quantityUsed,
      quantityAfter: stock.quantity,
      quantityUsed,
      metadata,
    });
  }

  async logStockWaste(
    stock: Stock,
    user: User,
    quantityWasted: number,
    reason: string,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    return this.createLog({
      stock,
      user,
      action: StockLogAction.WASTE,
      quantityBefore: stock.quantity + quantityWasted,
      quantityAfter: stock.quantity,
      quantityWasted,
      reason,
      metadata,
    });
  }

  async logStockExpiration(
    stock: Stock,
    user: User,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    return this.createLog({
      stock,
      user,
      action: StockLogAction.EXPIRE,
      quantityBefore: stock.quantity,
      quantityAfter: 0,
      quantityWasted: stock.quantity,
      reason: 'Produit expiré',
      metadata,
    });
  }

  async logStockSave(
    stock: Stock,
    user: User,
    quantitySaved: number,
    reason?: string,
    metadata?: Record<string, any>,
  ): Promise<StockLog> {
    return this.createLog({
      stock,
      user,
      action: StockLogAction.SAVE,
      quantityBefore: stock.quantity,
      quantityAfter: stock.quantity,
      quantitySaved,
      reason,
      metadata,
    });
  }

  async getWeeklyStats(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalUsed: number;
    totalWasted: number;
    totalSaved: number;
    logs: StockLog[];
  }> {
    const logs = await this.stockLogRepository.find({
      where: {
        user: { id: userId },
        createdAt: Between(startDate, endDate),
      },
      relations: ['stock', 'stock.product'],
      order: { createdAt: 'DESC' },
    });

    const stats = logs.reduce(
      (acc, log) => {
        acc.totalUsed += log.quantityUsed;
        acc.totalWasted += log.quantityWasted;
        acc.totalSaved += log.quantitySaved;
        return acc;
      },
      { totalUsed: 0, totalWasted: 0, totalSaved: 0 },
    );

    return { ...stats, logs };
  }

  async getUserStats(userId: string): Promise<{
    totalUsed: number;
    totalWasted: number;
    totalSaved: number;
  }> {
    const logs = await this.stockLogRepository.find({
      where: { user: { id: userId } },
    });

    return logs.reduce(
      (acc, log) => {
        acc.totalUsed += log.quantityUsed;
        acc.totalWasted += log.quantityWasted;
        acc.totalSaved += log.quantitySaved;
        return acc;
      },
      { totalUsed: 0, totalWasted: 0, totalSaved: 0 },
    );
  }
}
