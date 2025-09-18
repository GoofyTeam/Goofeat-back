import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
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
// @Index('UQ_recipe_external', ['externalId', 'externalSource'], {
//   unique: true,
//   where: 'externalSource != manual',
// })
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

  // Métadonnées de traçabilité pour les recettes externes
  @Expose({ groups: ['recipe:read', 'admin'] })
  @ApiProperty({
    description: 'Identifiant externe (ex: Spoonacular ID)',
    example: 'spoonacular_634561',
    required: false,
  })
  @Column({ type: 'varchar', nullable: true })
  externalId?: string;

  @Expose({ groups: ['recipe:read', 'admin'] })
  @ApiProperty({
    description: 'Source externe de la recette',
    example: 'spoonacular',
    enum: ['manual', 'spoonacular', 'marmiton'],
    required: false,
  })
  @Column({ type: 'varchar', default: 'manual' })
  externalSource: string = 'manual';

  @Expose({ groups: ['recipe:read', 'recipe:list', 'admin'] })
  @ApiProperty({
    description: "Pourcentage d'ingrédients mappés avec succès",
    example: 85.7,
    minimum: 0,
    maximum: 100,
    required: false,
  })
  @Column({ type: 'float', nullable: true })
  completenessScore?: number;

  @Expose({ groups: ['recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Indique si la recette contient tous les ingrédients mappés',
    example: true,
    required: false,
  })
  @Column({ type: 'boolean', default: true })
  isComplete: boolean = true;

  @Expose({ groups: ['recipe:read', 'admin'] })
  @ApiProperty({
    description: "Liste des ingrédients non mappés lors de l'import",
    example: ['heavy cream', 'vanilla extract'],
    type: [String],
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  missingIngredients?: string[];

  @Expose({ groups: ['admin', 'debug'] })
  @ApiProperty({
    description: 'Données brutes de la source externe',
    example: { spoonacularId: 634561, originalTitle: 'Classic Apple Pie' },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  externalData?: any;

  @Expose({ groups: ['default', 'recipe:read'] })
  @ApiProperty({
    description: 'Instructions étape par étape pour préparer la recette',
    example: [
      {
        name: 'Préparation',
        steps: [
          {
            number: 1,
            step: 'Préchauffez le four à 180°C.',
            ingredients: ['four'],
            equipment: ['four'],
          },
        ],
      },
    ],
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  instructions?: any[];

  @Expose({ groups: ['default', 'recipe:read', 'recipe:list'] })
  @ApiProperty({
    description: 'Ingrédients nécessaires',
    type: () => [RecipeIngredient],
  })
  @OneToMany(() => RecipeIngredient, (ingredient) => ingredient.recipe, {
    cascade: true,
    eager: true,
  })
  @Type(() => RecipeIngredient)
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
