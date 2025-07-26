import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { StockLogController } from './controllers/stock-log.controller';
import { StockLog } from './entities/stock-log.entity';
import { Stock } from './entities/stock.entity';
import { StockLogListener } from './listeners/stock-log.listener';
import { StockLogService } from './services/stock-log.service';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController, StockLogController],
  providers: [StockService, StockLogService, StockLogListener],
  imports: [TypeOrmModule.forFeature([Stock, StockLog, Product])],
  exports: [StockLogService],
})
export class StockModule {}
