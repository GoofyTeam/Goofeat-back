import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Unit } from 'src/common/units/unit.enums';

export class CreateProductDto {
  @ApiPropertyOptional({
    description: 'Code-barres du produit (null pour produits manuels)',
    example: '3017620422003',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Nom du produit',
    example: 'Nutella',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Description du produit',
    example: 'Pâte à tartiner aux noisettes et au cacao',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "URL de l'image du produit",
    example:
      'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.633.400.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Durée de conservation par défaut',
    example: '30 days',
  })
  @IsOptional()
  @IsString()
  defaultDlcTime?: string;

  @ApiPropertyOptional({
    description: 'Unité de mesure par défaut',
    enum: Unit,
    example: Unit.UNIT,
  })
  @IsOptional()
  defaultUnit?: Unit;

  @ApiPropertyOptional({
    description: "Taille d'une unité individuelle (en g, ml, etc.)",
    example: 30,
  })
  @IsOptional()
  unitSize?: number;

  @ApiPropertyOptional({
    description: "Taille de l'emballage standard (nombre d'unités)",
    example: 10,
  })
  @IsOptional()
  packagingSize?: number;

  @ApiPropertyOptional({
    description: "Liste des IDs d'ingrédients associés au produit",
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
  })
  @IsOptional()
  ingredients?: string[];
}
