import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class ConfirmReceiptRequestDto {
  @ApiProperty({ description: 'ID du ticket à confirmer' })
  @IsString()
  @IsUUID()
  receiptId: string;

  @ApiProperty({
    description: "Items confirmés par l'utilisateur",
    type: () => [ConfirmedReceiptItemDto],
  })
  @IsArray()
  confirmedItems: ConfirmedReceiptItemDto[];
}

export class ConfirmedReceiptItemDto {
  @ApiProperty({ description: "ID de l'item du ticket" })
  @IsString()
  @IsUUID()
  receiptItemId: string;

  @ApiProperty({
    description: "ID du produit sélectionné par l'utilisateur",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  productId?: string;

  @ApiProperty({ description: 'Quantité confirmée', example: 1.5 })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Prix unitaire confirmé',
    example: 2.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @ApiProperty({
    description: "Date d'expiration estimée",
    example: '2024-02-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: Date;

  @ApiProperty({ description: "Item confirmé par l'utilisateur" })
  @IsBoolean()
  confirmed: boolean;
}

export class ConfirmReceiptResponseDto {
  @ApiProperty({ description: 'Message de succès' })
  message: string;

  @ApiProperty({ description: 'ID du ticket confirmé' })
  receiptId: string;

  @ApiProperty({ description: "Nombre d'items confirmés et ajoutés au stock" })
  confirmedItems: number;
}
