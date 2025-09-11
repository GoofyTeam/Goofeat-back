import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME_HH_MM_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

export class UpdateNotificationPreferencesDto {
  @ApiProperty({
    description: 'Activer les notifications push',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  pushNotificationsEnabled?: boolean;

  @ApiProperty({
    description: 'Activer la vibration pour les notifications',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  vibrationEnabled?: boolean;

  @ApiProperty({
    description: 'Activer le son pour les notifications',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @ApiProperty({
    description: "Activer les alertes d'expiration des produits",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  stockExpirationEnabled?: boolean;

  @ApiProperty({
    description: 'Nombre de jours avant expiration pour recevoir une alerte',
    example: 3,
    minimum: 1,
    maximum: 14,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Le nombre de jours doit être au moins de 1' })
  @Max(14, { message: 'Le nombre de jours ne peut pas dépasser 14' })
  stockExpirationDays?: number;

  @ApiProperty({
    description: 'Activer les alertes de stock faible',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  lowStockEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les suggestions de recettes personnalisées',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  recipeRecommendationsEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les notifications de recettes tendance',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  trendingRecipesEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les rappels de repas',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  mealRemindersEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les notifications de mise à jour du foyer',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  householdUpdatesEnabled?: boolean;

  @ApiProperty({
    description: 'Activer les notifications de nouveau membre dans le foyer',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  newMemberEnabled?: boolean;

  @ApiProperty({
    description: 'Activer le mode silencieux pendant certaines heures',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  quietHoursEnabled?: boolean;

  @ApiProperty({
    description: 'Heure de début du mode silencieux (format HH:MM)',
    example: '22:00',
    pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_HH_MM_REGEX, {
    message: "Le format de l'heure doit être HH:MM (ex: 22:00)",
  })
  quietHoursStart?: string;

  @ApiProperty({
    description: 'Heure de fin du mode silencieux (format HH:MM)',
    example: '07:00',
    pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(TIME_HH_MM_REGEX, {
    message: "Le format de l'heure doit être HH:MM (ex: 07:00)",
  })
  quietHoursEnd?: string;
}
