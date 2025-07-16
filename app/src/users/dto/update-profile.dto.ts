/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { UserPreferences } from '../interfaces/user-preferences.interface';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  oldPassword?: string;

  @ValidateIf((o) => (o.oldPassword as string) !== undefined)
  @IsString()
  newPassword?: string;

  @IsOptional()
  @IsObject()
  preferences?: Partial<UserPreferences>;

  @IsOptional()
  @IsObject()
  notificationSettings?: Record<string, unknown>;
}
