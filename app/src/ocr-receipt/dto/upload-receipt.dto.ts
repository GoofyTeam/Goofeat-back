import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UploadReceiptDto {
  @ApiProperty({
    description:
      'Nom du magasin (optionnel, sera détecté automatiquement si non fourni)',
    example: 'Carrefour',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeName?: string;

  @ApiProperty({
    description: 'Adresse du magasin (optionnel)',
    example: '123 Rue de la République, 75001 Paris',
    required: false,
  })
  @IsOptional()
  @IsString()
  storeAddress?: string;
}

export class ParseReceiptResponseDto {
  @ApiProperty({ description: 'ID du ticket traité' })
  receiptId: string;

  @ApiProperty({ description: 'Statut du traitement' })
  status: string;

  @ApiProperty({
    description: "Score de confiance global de l'OCR",
    example: 0.85,
  })
  confidenceScore: number;

  @ApiProperty({ description: 'Nom du magasin détecté', example: 'Carrefour' })
  storeName?: string;

  @ApiProperty({
    description: 'Date du ticket',
    example: '2024-01-15T10:30:00Z',
  })
  receiptDate?: Date;

  @ApiProperty({ description: 'Montant total détecté', example: 45.67 })
  totalAmount?: number;

  @ApiProperty({ description: 'Parser utilisé', example: 'carrefour' })
  parserUsed: string;

  @ApiProperty({
    description: 'Produits détectés sur le ticket',
    type: 'array',
    items: { $ref: '#/components/schemas/ReceiptItemDto' },
  })
  items: ReceiptItemDto[];
}

export class ReceiptItemDto {
  @ApiProperty({ description: "ID de l'item" })
  id: string;

  @ApiProperty({
    description: 'Texte brut détecté',
    example: 'BANANES BIO 1KG',
  })
  rawText: string;

  @ApiProperty({ description: 'Nom parsé du produit', example: 'Bananes bio' })
  parsedName?: string;

  @ApiProperty({ description: 'ID du produit correspondant dans la DB' })
  matchedProductId?: string;

  @ApiProperty({ description: 'Nom du produit correspondant' })
  matchedProductName?: string;

  @ApiProperty({ description: 'Quantité détectée', example: 1 })
  quantity: number;

  @ApiProperty({ description: 'Unité', example: 'kg' })
  unit: string;

  @ApiProperty({ description: 'Prix unitaire', example: 3.99 })
  unitPrice?: number;

  @ApiProperty({ description: 'Prix total', example: 3.99 })
  totalPrice: number;

  @ApiProperty({
    description: 'Score de confiance pour cet item',
    example: 0.92,
  })
  confidenceScore: number;

  @ApiProperty({
    description: 'Suggestions de produits similaires',
    type: 'array',
    items: { $ref: '#/components/schemas/ProductSuggestionDto' },
  })
  suggestions?: ProductSuggestionDto[];
}

export class ProductSuggestionDto {
  @ApiProperty({ description: 'ID du produit suggéré' })
  id: string;

  @ApiProperty({ description: 'Nom du produit suggéré' })
  name: string;

  @ApiProperty({ description: 'Score de similarité', example: 0.85 })
  score: number;
}
