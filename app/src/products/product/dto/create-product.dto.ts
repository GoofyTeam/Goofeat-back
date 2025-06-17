import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({
    description: 'Identifiant du produit (code-barres)',
    example: '3017620422003',
  })
  id: string;

  @ApiProperty({
    description: 'Nom du produit',
    example: 'Nutella',
  })
  name: string;

  @ApiProperty({
    description: 'Description du produit',
    example: 'Pâte à tartiner aux noisettes et au cacao',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: "URL de l'image du produit",
    example: 'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.633.400.jpg',
    required: false,
  })
  imageUrl?: string;

  @ApiProperty({
    description: 'Durée de conservation par défaut',
    example: '30 days',
    required: false,
  })
  defaultDlcTime?: string;
}
