import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiProperty({
    description: 'Activer les notifications push',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiProperty({ description: 'Activer la vibration', required: false })
  @IsOptional()
  @IsBoolean()
  vibrationEnabled?: boolean;

  @ApiProperty({ description: 'Activer le son', required: false })
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @ApiProperty({
    description: "Activer les alertes d'expiration",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  stockExpirationEnabled?: boolean;

  @ApiProperty({
    description: 'Nombre de jours avant expiration pour alerter',
    required: false,
    minimum: 1,
    maximum: 14,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(14)
  stockExpirationDays?: number;

  @ApiProperty({
    description: 'Activer les alertes de stock faible',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  lowStockEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les suggestions de recettes',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  recipeRecommendationsEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les recettes tendance',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  trendingRecipesEnabled?: boolean;

  @ApiProperty({ description: 'Activer les rappels de repas', required: false })
  @IsOptional()
  @IsBoolean()
  mealRemindersEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les mises à jour du foyer',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  householdUpdatesEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les alertes nouveau membre',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  newMemberEnabled?: boolean;

  @ApiProperty({ description: 'Activer le mode silencieux', required: false })
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @ApiProperty({
    description: 'Heure de début du mode silencieux (HH:MM)',
    required: false,
  })
  @IsOptional()
  @IsString()
  quietHoursStart?: string;

  @ApiProperty({
    description: 'Heure de fin du mode silencieux (HH:MM)',
    required: false,
  })
  @IsOptional()
  @IsString()
  quietHoursEnd?: string;
}
