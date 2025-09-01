import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmReceiptItemDto {
  @ApiProperty({ description: "ID de l'item du ticket" })
  @IsUUID()
  itemId: string;

  @ApiProperty({
    description: 'ID du produit correspondant (si sélectionné)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({
    description: "Nom du produit (si création d'un nouveau produit)",
    required: false,
  })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiProperty({ description: 'Quantité confirmée', example: 2 })
  @IsNumber()
  quantity: number;

  @ApiProperty({ description: 'Unité confirmée', example: 'kg' })
  @IsString()
  unit: string;

  @ApiProperty({ description: 'Prix total confirmé', example: 5.98 })
  @IsNumber()
  totalPrice: number;

  @ApiProperty({
    description: "L'utilisateur confirme ce produit pour ajout au stock",
    default: true,
  })
  @IsBoolean()
  addToStock: boolean;

  @ApiProperty({
    description: 'Date de péremption prédite (optionnel)',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  predictedDlc?: Date;

  @ApiProperty({
    description: 'Commentaire ou correction manuelle',
    required: false,
  })
  @IsOptional()
  @IsString()
  manualCorrection?: string;
}

export class ConfirmReceiptDto {
  @ApiProperty({ description: 'ID du ticket à confirmer' })
  @IsUUID()
  receiptId: string;

  @ApiProperty({
    description: 'Liste des items confirmés',
    type: [ConfirmReceiptItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmReceiptItemDto)
  items: ConfirmReceiptItemDto[];

  @ApiProperty({
    description: 'Créer des stocks pour tous les produits confirmés',
    default: true,
  })
  @IsBoolean()
  createStocks: boolean;
}

export class ConfirmReceiptResponseDto {
  @ApiProperty({ description: 'ID du ticket confirmé' })
  receiptId: string;

  @ApiProperty({ description: 'Nombre de produits ajoutés au stock' })
  stocksCreated: number;

  @ApiProperty({ description: 'Nombre de nouveaux produits créés' })
  newProductsCreated: number;

  @ApiProperty({ description: 'Liste des stocks créés', type: [String] })
  stockIds: string[];

  @ApiProperty({
    description: 'Détail du traitement',
    type: 'array',
    items: { $ref: '#/components/schemas/ProcessingResultDto' },
  })
  processingResults: ProcessingResultDto[];
}

export class ProcessingResultDto {
  @ApiProperty({ description: "ID de l'item traité" })
  itemId: string;

  @ApiProperty({ description: 'Nom du produit traité' })
  productName: string;

  @ApiProperty({ description: 'Action effectuée', example: 'stock_created' })
  action: 'stock_created' | 'product_created' | 'skipped' | 'error';

  @ApiProperty({ description: 'ID du stock créé (si applicable)' })
  stockId?: string;

  @ApiProperty({ description: 'ID du produit créé (si applicable)' })
  productId?: string;

  @ApiProperty({ description: "Message d'erreur (si applicable)" })
  error?: string;
}
