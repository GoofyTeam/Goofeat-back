import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateIngredientDto {
  @ApiProperty({
    description: "Nom de l'ingrédient",
    example: 'Tomate',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Nom français (optionnel, sera généré si manquant)',
    example: 'Tomate',
    required: false,
  })
  @IsString()
  @IsOptional()
  nameFr?: string;

  @ApiProperty({
    description: 'Nom anglais (optionnel, sera généré si manquant)',
    example: 'Tomato',
    required: false,
  })
  @IsString()
  @IsOptional()
  nameEn?: string;

  @ApiProperty({
    description: 'Tag Open Food Facts (optionnel)',
    example: 'en:tomato',
    required: false,
  })
  @IsString()
  @IsOptional()
  offTag?: string;

  @ApiProperty({
    description: 'Identifiant de la catégorie (optionnel)',
    required: false,
  })
  @IsString()
  @IsOptional()
  categoryId?: string;
}
