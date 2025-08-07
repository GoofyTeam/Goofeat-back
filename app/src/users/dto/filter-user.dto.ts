import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Role } from '../enums/role.enum';

export class FilterUserDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Recherche par email ou nom',
    example: 'john@example.com',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par rôle',
    enum: Role,
    example: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    description: 'Filtrer par statut de vérification email',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isEmailVerified?: boolean;

  @ApiPropertyOptional({
    description: 'Trier par date de création (desc ou asc)',
    example: 'desc',
    enum: ['desc', 'asc'],
  })
  @IsOptional()
  @IsString()
  sortByCreatedAt?: 'desc' | 'asc' = 'desc';
}
