import { ApiProperty } from '@nestjs/swagger';

export class ProductSuggestionResponseDto {
  @ApiProperty({ description: 'ID du produit suggéré' })
  productId: string;

  @ApiProperty({
    description: 'Nom du produit',
    example: 'Bananes bio équitables',
  })
  name: string;

  @ApiProperty({ description: 'Marque du produit', example: 'Bio Village' })
  brand?: string;

  @ApiProperty({ description: 'Score de correspondance (0-1)', example: 0.87 })
  matchScore: number;

  @ApiProperty({ description: 'Catégorie', example: 'Fruits et légumes' })
  category?: string;
}

export class ReceiptItemResponseDto {
  @ApiProperty({ description: "ID de l'item détecté" })
  id: string;

  @ApiProperty({ description: 'Nom du produit parsé', example: 'Bananes Bio' })
  productName: string;

  @ApiProperty({ description: 'Quantité détectée', example: 1.5 })
  quantity: number;

  @ApiProperty({ description: 'Unité', example: 'kg' })
  unit: string;

  @ApiProperty({ description: 'Prix unitaire', example: 2.99 })
  unitPrice?: number;

  @ApiProperty({ description: 'Prix total', example: 4.49 })
  totalPrice: number;

  @ApiProperty({ description: 'Score de confiance (0-1)', example: 0.92 })
  confidence: number;

  @ApiProperty({
    description: 'Meilleure suggestion de produit',
    required: false,
    type: () => ProductSuggestionResponseDto,
  })
  suggestedProduct?: ProductSuggestionResponseDto;
}

export class UploadReceiptResponseDto {
  @ApiProperty({ description: 'ID unique du ticket traité' })
  receiptId: string;

  @ApiProperty({ description: 'Nom du magasin détecté', example: 'Carrefour' })
  storeName: string;

  @ApiProperty({
    description: 'Date du ticket',
    example: '2024-01-15T10:30:00Z',
  })
  receiptDate?: Date;

  @ApiProperty({ description: 'Montant total détecté', example: 45.67 })
  totalAmount?: number;

  @ApiProperty({
    description: 'Score de confiance global (0-1)',
    example: 0.85,
  })
  confidence: number;

  @ApiProperty({
    description: 'Items détectés sur le ticket',
    type: () => [ReceiptItemResponseDto],
  })
  items: ReceiptItemResponseDto[];

  @ApiProperty({
    description: 'Suggestions de produits',
    type: () => [ProductSuggestionResponseDto],
  })
  suggestedProducts: ProductSuggestionResponseDto[];
}
