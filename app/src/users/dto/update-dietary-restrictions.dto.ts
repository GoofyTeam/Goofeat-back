import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { DietaryRestriction } from '../enums/dietary-restriction.enum';

export class UpdateDietaryRestrictionsDto {
  @ApiProperty({
    description: 'Liste des allergènes à éviter',
    example: ['arachides', 'fruits de mer', 'lactose'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergenes?: string[];

  @ApiProperty({
    description: "Catégories d'aliments préférées",
    example: ['légumes', 'fruits', 'céréales'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredCategories?: string[];

  @ApiProperty({
    description: "Catégories d'aliments à exclure",
    example: ['viande rouge', 'produits transformés'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCategories?: string[];

  @ApiProperty({
    description: 'Restrictions alimentaires spécifiques',
    example: [DietaryRestriction.VEGAN, DietaryRestriction.GLUTEN_FREE],
    required: false,
    enum: DietaryRestriction,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DietaryRestriction, { each: true })
  dietaryRestrictions?: DietaryRestriction[];
}
