import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Category } from 'src/categories/entities/category.entity';
import { Product } from 'src/products/entities/product.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  /**
   * Tag unique Open Food Facts (ex: en:garlic-extract)
   */
  @ApiProperty({ description: 'Tag unique OFF', example: 'en:garlic-extract' })
  @Column({ type: 'varchar', unique: true, nullable: false })
  @Expose({ groups: ['ingredient:read', 'product:barcode-min'] })
  offTag: string;

  /**
   * Nom français (issu de la taxonomie OFF)
   */
  @ApiProperty({ description: 'Nom français', example: "Extrait d'ail" })
  @Column({ type: 'varchar', nullable: false })
  @Expose({ groups: ['ingredient:read', 'stock:read'] })
  nameFr: string;

  /**
   * Nom anglais (issu de la taxonomie OFF)
   */
  @ApiProperty({ description: 'Nom anglais', example: 'Garlic extract' })
  @Column({ type: 'varchar', nullable: false })
  @Expose({ groups: ['ingredient:read', 'stock:read'] })
  nameEn: string;

  /**
   * Identifiant Wikidata (optionnel)
   */
  @ApiProperty({
    description: 'Wikidata ID',
    example: 'Q123456',
    required: false,
  })
  @Column({ type: 'varchar', nullable: true })
  wikidata?: string;

  /**
   * Tags OFF parents (pour la hiérarchie)
   */
  @ApiProperty({
    description: 'Tags OFF parents',
    type: [String],
    required: false,
  })
  @Column({ type: 'varchar', array: true, nullable: true })
  parentOffTags?: string[];

  @Expose({
    groups: ['ingredient:list', 'ingredient:read', 'product:barcode-min'],
  })
  @ApiProperty({
    description: "Identifiant unique de l'ingrédient",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose({
    groups: ['ingredient:list', 'ingredient:read', 'product:barcode-min'],
  })
  @ApiProperty({
    description: "Nom de l'ingrédient générique",
    example: 'Farine de blé',
  })
  @Column({ type: 'varchar', unique: true })
  name: string;

  @Expose({ groups: ['ingredient:read'] })
  @ApiProperty({
    description: 'Identifiant de la catégorie parente',
    required: false,
  })
  @Column({ nullable: true })
  categoryId?: string;

  @ManyToOne(() => Category, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  @Expose({ groups: ['ingredient:read'] })
  @Type(() => Category)
  category?: Category;

  @ManyToMany(() => Product, (product) => product.ingredients)
  products: Product[];

  @CreateDateColumn()
  @Expose({ groups: ['ingredient:read'] })
  createdAt: Date;

  @UpdateDateColumn()
  @Expose({ groups: ['ingredient:read'] })
  updatedAt: Date;
}
