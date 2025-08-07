import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export enum ProductTypeFilter {
  ALL = 'all',
  MANUAL = 'manual',
  BARCODE = 'barcode',
}

export class FilterProductDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Recherche par nom de produit',
    example: 'Nutella',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Type de produit à filtrer',
    enum: ProductTypeFilter,
    example: ProductTypeFilter.ALL,
  })
  @IsOptional()
  @IsEnum(ProductTypeFilter)
  type?: ProductTypeFilter = ProductTypeFilter.ALL;

  @ApiPropertyOptional({
    description: 'Afficher uniquement mes produits manuels',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  onlyMyProducts?: boolean = false;

  @ApiPropertyOptional({
    description: 'Recherche par code-barres (exact)',
    example: '3017620422003',
  })
  @IsOptional()
  @IsString()
  code?: string;
}
