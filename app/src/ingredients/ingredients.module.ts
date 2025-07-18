import { Module, forwardRef } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { ProductModule } from 'src/products/product.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from './entities/ingredient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ingredient]),
    forwardRef(() => ProductModule),
  ],
  providers: [IngredientsService],
  exports: [TypeOrmModule, IngredientsService],
})
export class IngredientsModule {}
