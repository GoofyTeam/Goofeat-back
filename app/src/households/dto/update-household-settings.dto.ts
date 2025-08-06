import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class NotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  stockUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  childActions?: boolean;

  @IsOptional()
  @IsBoolean()
  expirationAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  memberJoined?: boolean;

  @IsOptional()
  @IsBoolean()
  onlyParentsForApproval?: boolean;

  @IsOptional()
  @IsIn(['instant', 'daily', 'weekly', 'disabled'])
  digestMode?: 'instant' | 'daily' | 'weekly' | 'disabled';
}

export class ChildApprovalSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'autoExpireHours doit être au minimum 1 heure' })
  @Max(168, {
    message: 'autoExpireHours ne peut pas dépasser 168 heures (7 jours)',
  })
  autoExpireHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'maxQuantityWithoutApproval ne peut pas être négative' })
  maxQuantityWithoutApproval?: number;
}

export class UpdateHouseholdSettingsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ChildApprovalSettingsDto)
  childApproval?: ChildApprovalSettingsDto;
}
