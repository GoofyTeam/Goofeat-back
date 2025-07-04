import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { MockProductService } from './lib/mock-product.service';
import { OpenFoodFactsService } from './lib/openfoodfacts.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product]), HttpModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    {
      provide: 'PRODUCT_DATA_SERVICE',
      useClass: OpenFoodFactsService,
    },
    OpenFoodFactsService,
    MockProductService,
  ],
  exports: [ProductService],
})
export class ProductModule {}
