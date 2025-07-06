import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Unit } from 'src/common/units/unit.enums';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import { Stock } from 'src/stocks/entities/stock.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
// import { Category } from '../../../categories/category/entities/category.entity';

@Entity('products')
export class Product {
  @Expose({ groups: ['default', 'product:read', 'product:list'] })
  @ApiProperty({
    description: 'Identifiant du produit (code-barres)',
    example: '3017620422003',
  })
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @OneToMany(() => Stock, (stock) => stock.product)
  stocks: Stock[];

  @Expose({ groups: ['default', 'product:read', 'product:list'] })
  @Column({ type: 'varchar' })
  code: string;

  @Expose({ groups: ['default', 'product:read', 'product:list'] })
  @ApiProperty({
    description: 'Nom du produit',
    example: 'Nutella',
  })
  @Column({ type: 'varchar' })
  name: string;

  @Expose({ groups: ['default', 'product:read'] })
  @ApiProperty({
    description: 'Description du produit',
    example: 'Pâte à tartiner aux noisettes et au cacao',
  })
  @Column({ type: 'varchar' })
  description: string;

  @Expose({ groups: ['default', 'product:read', 'product:list'] })
  @ApiProperty({
    description: "URL de l'image du produit",
    example:
      'https://images.openfoodfacts.org/images/products/301/762/042/2003/front_en.633.400.jpg',
  })
  @Column({ type: 'varchar' })
  imageUrl: string;

  @Expose({ groups: ['product:read', 'admin'] })
  @ApiProperty({
    description: 'Durée de conservation par défaut',
    example: '30 days',
  })
  @Column({ type: 'interval', default: '30 days' })
  defaultDlcTime: string;

  @Expose({ groups: ['product:read', 'admin'] })
  @ApiProperty({
    description: 'Date de création',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @Expose({ groups: ['product:read', 'admin'] })
  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;

  @Expose({ groups: ['product:read', 'nutrition'] })
  @ApiProperty({
    description: 'Informations nutritionnelles du produit',
    example: { 'energy-kcal_100g': 539, fat_100g: 30.9, sugars_100g: 56.3 },
  })
  @Column({ type: 'jsonb', nullable: true })
  nutriments?: any;

  @Expose({ groups: ['admin', 'debug'] })
  @ApiProperty({
    description: "Données brutes du produit (provenant d'OpenFoodFacts)",
    example: { code: '3017620422003', product_name: 'Nutella' },
  })
  @Column({ type: 'jsonb', nullable: true })
  rawData?: any;

  @Expose({ groups: ['product:read', 'admin'] })
  @ApiProperty({
    description: 'Unité de mesure par défaut du produit',
    example: 'tranche',
  })
  @Column({ type: 'enum', enum: Unit, nullable: true })
  defaultUnit?: Unit;

  @Expose({ groups: ['product:read', 'admin'] })
  @ApiProperty({
    description: "Taille d'une unité individuelle (en g, ml, etc.)",
    example: 30,
  })
  @Column({ type: 'float', nullable: true })
  unitSize?: number;

  @Expose({ groups: ['product:read', 'admin'] })
  @ApiProperty({
    description: "Taille de l'emballage standard (nombre d'unités)",
    example: 10,
  })
  @Column({ type: 'float', nullable: true })
  packagingSize?: number;

  @Expose({ groups: ['product:read'] })
  @ApiProperty({
    description: "Identifiant de l'ingrédient générique associé",
  })
  @Column()
  ingredientId: string;

  @ManyToOne(() => Ingredient, (ingredient) => ingredient.products, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient;
}
