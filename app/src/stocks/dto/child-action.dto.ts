import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';

export enum ChildActionType {
  TAKE_SOME = 'take_some', // J'en ai pris un peu
  TAKE_ALL = 'take_all', // J'ai tout pris
  ALMOST_EMPTY = 'almost_empty', // Il en reste presque plus
  EMPTY = 'empty', // C'est fini
  FOUND_MORE = 'found_more', // J'en ai trouvé d'autres
}

export enum QuantitySize {
  LITTLE = 'little', // Un peu
  NORMAL = 'normal', // Normal
  LOT = 'lot', // Beaucoup
}

export class ChildActionDto {
  @ApiProperty({
    description: 'ID du produit concerné',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsNotEmpty({ message: "L'ID du produit est obligatoire" })
  @IsUUID(4, { message: "L'ID du produit doit être un UUID valide" })
  productId: string;

  @ApiProperty({
    description: "Type d'action effectuée",
    enum: ChildActionType,
    example: ChildActionType.TAKE_SOME,
  })
  @IsEnum(ChildActionType, { message: "Type d'action invalide" })
  action: ChildActionType;

  @ApiProperty({
    description: 'Taille approximative de la quantité (pour take_some)',
    enum: QuantitySize,
    example: QuantitySize.NORMAL,
    required: false,
  })
  @IsOptional()
  @IsEnum(QuantitySize, { message: 'Taille de quantité invalide' })
  quantitySize?: QuantitySize;

  @ApiProperty({
    description: 'Quantité exacte si connue',
    example: 2,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsPositive({ message: 'La quantité doit être positive' })
  exactQuantity?: number;

  @ApiProperty({
    description: 'Commentaire ou raison',
    example: 'Pour mon goûter',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le commentaire doit être une chaîne de caractères' })
  comment?: string;
}

export class QuickConsumeDto {
  @ApiProperty({
    description: 'ID du stock concerné',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsNotEmpty({ message: "L'ID du stock est obligatoire" })
  @IsUUID(4, { message: "L'ID du stock doit être un UUID valide" })
  stockId: string;

  @ApiProperty({
    description: 'Quantité consommée',
    example: 1,
    minimum: 0,
  })
  @IsPositive({ message: 'La quantité doit être positive' })
  quantity: number;

  @ApiProperty({
    description: 'Commentaire',
    example: 'Collation après-midi',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Le commentaire doit être une chaîne de caractères' })
  comment?: string;
}
