/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { UserPreferences } from '../interfaces/user-preferences.interface';

export class UpdateProfileV1Dto {
  @ApiProperty({
    description: 'Prénom',
    example: 'Jean',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Dupont',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'Email',
    example: 'jean.dupont@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Mot de passe actuel (requis pour changer le mot de passe)',
    example: 'oldpassword123',
    required: false,
  })
  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (requis si oldPassword est fourni)',
    example: 'newpassword123',
    required: false,
  })
  @ValidateIf((o) => (o.oldPassword as string) !== undefined)
  @IsString()
  newPassword?: string;

  @ApiProperty({
    description: 'Préférences utilisateur',
    example: { theme: 'dark', language: 'fr' },
    required: false,
  })
  @IsOptional()
  @IsObject()
  preferences?: Partial<UserPreferences>;

  @ApiProperty({
    description: 'Paramètres de notification',
    example: { email: true, push: false },
    required: false,
  })
  @IsOptional()
  @IsObject()
  notificationSettings?: Record<string, unknown>;
}
