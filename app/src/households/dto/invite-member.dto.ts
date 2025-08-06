import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HouseholdRole } from '../enums/household-role.enum';

export class InviteMemberDto {
  @ApiProperty({
    description: 'Email de la personne à inviter',
    example: 'jean.dupont@email.com',
  })
  @IsNotEmpty({ message: "L'email est obligatoire" })
  @IsEmail({}, { message: "Format d'email invalide" })
  email: string;

  @ApiProperty({
    description: 'Rôle dans le foyer',
    enum: HouseholdRole,
    example: HouseholdRole.PARENT,
  })
  @IsEnum(HouseholdRole, { message: 'Rôle invalide' })
  role: HouseholdRole;

  @ApiProperty({
    description: 'Surnom dans le foyer',
    example: 'Papa',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le surnom doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'Le surnom ne peut pas dépasser 50 caractères' })
  nickname?: string;
}

export class JoinHouseholdDto {
  @ApiProperty({
    description: "Code d'invitation",
    example: 'ABC123',
  })
  @IsNotEmpty({ message: "Le code d'invitation est obligatoire" })
  @IsString({ message: 'Le code doit être une chaîne de caractères' })
  inviteCode: string;

  @ApiProperty({
    description: 'Surnom souhaité dans le foyer',
    example: 'Maman',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le surnom doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'Le surnom ne peut pas dépasser 50 caractères' })
  nickname?: string;
}
