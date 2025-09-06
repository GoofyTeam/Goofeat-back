import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HouseholdType } from '../enums/household-type.enum';

export class UpdateHouseholdDto {
  @ApiProperty({
    description: 'Nom du foyer',
    example: 'Famille Durand',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @MaxLength(100, { message: 'Le nom ne peut pas dépasser 100 caractères' })
  name?: string;

  @ApiProperty({
    description: 'Type de foyer',
    enum: HouseholdType,
    example: HouseholdType.FAMILY,
    required: false,
  })
  @IsOptional()
  @IsEnum(HouseholdType, { message: 'Type de foyer invalide' })
  type?: HouseholdType;

  @ApiProperty({
    description: 'Description du foyer',
    example: 'Notre petite famille de 4 personnes',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  description?: string;

  @ApiProperty({
    description: 'Paramètres du foyer',
    example: { notifications: { familyAlerts: true } },
    required: false,
  })
  @IsOptional()
  settings?: Record<string, unknown>;

  @ApiProperty({
    description: 'Foyer actif ou non',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive doit être un booléen' })
  isActive?: boolean;
}
