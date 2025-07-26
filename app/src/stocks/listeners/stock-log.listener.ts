import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { User } from '../../users/entity/user.entity';
import { Stock } from '../entities/stock.entity';
import { StockLogService } from '../services/stock-log.service';

export interface StockActionEvent {
  stock: Stock;
  user: User;
  oldQuantity?: number;
  oldDlc?: Date;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface StockUsageEvent {
  stock: Stock;
  user: User;
  quantityUsed: number;
  metadata?: Record<string, any>;
}

export interface StockWasteEvent {
  stock: Stock;
  user: User;
  quantityWasted: number;
  reason: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class StockLogListener {
  private readonly logger = new Logger(StockLogListener.name);

  constructor(private readonly stockLogService: StockLogService) {}

  @OnEvent('stock.created')
  async handleStockCreated(event: StockActionEvent): Promise<void> {
    this.logger.log(`Stock créé: ${event.stock.id}`);
    await this.stockLogService.logStockCreation(
      event.stock,
      event.user,
      event.metadata,
    );
  }

  @OnEvent('stock.updated')
  async handleStockUpdated(event: StockActionEvent): Promise<void> {
    this.logger.log(`Stock mis à jour: ${event.stock.id}`);
    await this.stockLogService.logStockUpdate(
      event.stock,
      event.user,
      event.oldQuantity || 0,
      event.oldDlc,
      event.metadata,
    );
  }

  @OnEvent('stock.deleted')
  async handleStockDeleted(event: StockActionEvent): Promise<void> {
    this.logger.log(`Stock supprimé: ${event.stock.id}`);
    await this.stockLogService.logStockDeletion(
      event.stock,
      event.user,
      event.reason,
      event.metadata,
    );
  }

  @OnEvent('stock.used')
  async handleStockUsed(event: StockUsageEvent): Promise<void> {
    this.logger.log(
      `Stock utilisé: ${event.stock.id} - ${event.quantityUsed} unités`,
    );
    await this.stockLogService.logStockUsage(
      event.stock,
      event.user,
      event.quantityUsed,
      event.metadata,
    );
  }

  @OnEvent('stock.wasted')
  async handleStockWasted(event: StockWasteEvent): Promise<void> {
    this.logger.log(
      `Stock gaspillé: ${event.stock.id} - ${event.quantityWasted} unités`,
    );
    await this.stockLogService.logStockWaste(
      event.stock,
      event.user,
      event.quantityWasted,
      event.reason,
      event.metadata,
    );
  }

  @OnEvent('stock.expired')
  async handleStockExpired(event: StockActionEvent): Promise<void> {
    this.logger.log(`Stock expiré: ${event.stock.id}`);
    await this.stockLogService.logStockExpiration(
      event.stock,
      event.user,
      event.metadata,
    );
  }
}
