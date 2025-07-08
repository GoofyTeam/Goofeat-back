import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/products/entities/product.entity';
import { Stock } from './entities/stock.entity';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  controllers: [StockController],
  providers: [StockService],
  imports: [TypeOrmModule.forFeature([Stock, Product])],
})
export class StockModule {}
