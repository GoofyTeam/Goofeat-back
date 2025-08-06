import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdModule } from 'src/households/household.module';
import { Product } from 'src/products/entities/product.entity';
import { ChildStockController } from './controllers/child-stock.controller';
import { StockLogController } from './controllers/stock-log.controller';
import { PendingStockAction } from './entities/pending-stock-action.entity';
import { StockLog } from './entities/stock-log.entity';
import { Stock } from './entities/stock.entity';
import { StockLogListener } from './listeners/stock-log.listener';
import { ChildStockService } from './services/child-stock.service';
import { StockLogService } from './services/stock-log.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController, StockLogController, ChildStockController],
  providers: [
    StockService,
    StockLogService,
    StockLogListener,
    ChildStockService,
  ],
  imports: [
    TypeOrmModule.forFeature([Stock, StockLog, Product, PendingStockAction]),
    HouseholdModule,
  ],
  exports: [StockLogService, ChildStockService],
})
export class StockModule {}
