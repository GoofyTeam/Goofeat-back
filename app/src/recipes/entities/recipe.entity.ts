import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RecipeIngredient } from './recipe-ingredient.entity';

@Entity('recipes')
export class Recipe {
  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Identifiant unique de la recette',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Nom de la recette',
    example: 'Tarte aux pommes',
  })
  @Column({ type: 'varchar' })
  name: string;

  @Expose({ groups: ['default', 'recipe:read'] })
  @ApiProperty({
    description: 'Description détaillée de la recette',
    example: 'Une délicieuse tarte aux pommes familiale',
  })
  @Column({ type: 'varchar' })
  description: string;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: "URL de l'image de la recette",
    example: 'https://example.com/images/tarte-aux-pommes.jpg',
  })
  @Column({ type: 'varchar', nullable: true })
  imageUrl: string;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Temps de préparation en minutes',
    example: 30,
  })
  @Column({ type: 'int' })
  preparationTime: number;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Temps de cuisson en minutes',
    example: 45,
  })
  @Column({ type: 'int', nullable: true })
  cookingTime: number;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Nombre de portions',
    example: 4,
  })
  @Column({ type: 'int' })
  servings: number;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Difficulté de la recette',
    example: 'Facile',
    enum: ['Facile', 'Intermédiaire', 'Difficile', 'Expert'],
  })
  @Column({ type: 'varchar' })
  difficulty: string;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Score nutritionnel global',
    example: 'A',
    enum: ['A', 'B', 'C', 'D', 'E'],
  })
  @Column({ type: 'varchar', length: 1, nullable: true })
  nutriScore: string;

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Catégories de la recette',
    example: ['Dessert', 'Fruit', 'Sucré'],
    type: [String],
  })
  @Column('text', { array: true, nullable: true })
  categories: string[];

  @Expose({ groups: ['default', 'recipe:read'] })
  @ApiProperty({
    description: 'Ingrédients nécessaires',
    type: () => [RecipeIngredient],
  })
  @OneToMany(() => RecipeIngredient, (ingredient) => ingredient.recipe, {
    cascade: true,
    eager: true,
  })
  ingredients: RecipeIngredient[];

  @Expose({ groups: ['recipe:read', 'admin'] })
  @ApiProperty({
    description: 'Date de création',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @Expose({ groups: ['recipe:read', 'admin'] })
  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
