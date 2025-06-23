import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRecipeIngredientDto {
  @ApiProperty({
    description: "ID de l'ingrédient générique",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty()
  @IsUUID()
  ingredientId: string;

  @ApiProperty({
    description: 'Quantité nécessaire',
    example: 4,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Unité de mesure',
    example: 'pièce',
  })
  @IsNotEmpty()
  @IsString()
  unit: string;

  @ApiProperty({
    description: "Indique si l'ingrédient est optionnel",
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isOptional?: boolean;
}
