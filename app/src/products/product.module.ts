import { HttpModule } from '@nestjs/axios';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from 'src/common/elasticsearch/elasticsearch.module';
import { OpenFoodFactsAnalyzerService } from 'src/common/units/openfoodfacts-analyzer.service';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { IngredientsModule } from 'src/ingredients/ingredients.module';
import { Product } from './entities/product.entity';
import { MockProductService } from './lib/mock-product.service';
import { OpenFoodFactsService } from './lib/openfoodfacts.service';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, Ingredient]),
    HttpModule,
    ElasticsearchModule,
    forwardRef(() => IngredientsModule),
  ],
  controllers: [ProductController],
  providers: [
    ProductService,
    {
      provide: 'PRODUCT_DATA_SERVICE',
      useClass: OpenFoodFactsService,
    },
    OpenFoodFactsService,
    OpenFoodFactsAnalyzerService,
    MockProductService,
  ],
  exports: [ProductService],
})
export class ProductModule {}
