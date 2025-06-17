import { ApiProperty } from '@nestjs/swagger';
import { Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
// import { Category } from '../../../categories/category/entities/category.entity';

export class Product {
  @ApiProperty({
    description: 'Identifiant du produit (code-barres)',
    example: '3017620422003',
  })
  @Column({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar' })
  code: string;

  @ApiProperty({
    description: 'Nom du produit',
    example: 'Nutella',
  })
  @Column({ type: 'varchar' })
  name: string;

  @ApiProperty({
    description: 'Description du produit',
    example: 'Pâte à tartiner aux noisettes et au cacao',
  })
  @Column({ type: 'varchar' })
  description: string;

  @ApiProperty({
    description: "URL de l'image du produit",
    example:
      'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.633.400.jpg',
  })
  @Column({ type: 'varchar' })
  imageUrl: string;

  @ApiProperty({
    description: 'Durée de conservation par défaut',
    example: '30 days',
  })
  @Column({ type: 'interval', default: '30 days' })
  defaultDlcTime: string;

  @ApiProperty({
    description: 'Date de création',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({
    description: 'Informations nutritionnelles du produit',
    example: { 'energy-kcal_100g': 539, fat_100g: 30.9, sugars_100g: 56.3 },
  })
  @Column({ type: 'jsonb' })
  nutriments: any;

  @ApiProperty({
    description: "Données brutes du produit (provenant d'OpenFoodFacts)",
    example: { code: '3017620422003', product_name: 'Nutella' },
  })
  @Column({ type: 'jsonb' })
  rawData: any;

  // @ManyToMany(() => Category)
  // @JoinTable()
  // categories: Category[];
}
