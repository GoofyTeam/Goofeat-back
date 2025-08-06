import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HouseholdRole } from '../enums/household-role.enum';

export class UpdateMemberDto {
  @ApiProperty({
    description: 'Rôle dans le foyer',
    enum: HouseholdRole,
    example: HouseholdRole.PARENT,
    required: false,
  })
  @IsOptional()
  @IsEnum(HouseholdRole, { message: 'Rôle invalide' })
  role?: HouseholdRole;

  @ApiProperty({
    description: 'Surnom dans le foyer',
    example: 'Papa',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le surnom doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'Le surnom ne peut pas dépasser 50 caractères' })
  nickname?: string;

  @ApiProperty({
    description: 'Peut modifier les stocks',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'canEditStock doit être un booléen' })
  canEditStock?: boolean;

  @ApiProperty({
    description: 'Les actions nécessitent une approbation parentale',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'needsApproval doit être un booléen' })
  needsApproval?: boolean;

  @ApiProperty({
    description: 'Peut voir tous les stocks du foyer',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'canViewAllStocks doit être un booléen' })
  canViewAllStocks?: boolean;

  @ApiProperty({
    description: 'Peut inviter de nouveaux membres',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'canInviteMembers doit être un booléen' })
  canInviteMembers?: boolean;

  @ApiProperty({
    description: 'Membre actif ou non',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive doit être un booléen' })
  isActive?: boolean;
}
