import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Recipe } from './recipe.entity';

@Entity('recipe_ingredients')
export class RecipeIngredient {
  @Expose({ groups: ['default', 'recipe:read', 'recipe-ingredient:read'] })
  @ApiProperty({
    description: "Identifiant unique de l'ingrédient dans la recette",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose({ groups: ['recipe:read', 'recipe-ingredient:read'] })
  @ApiProperty({
    description: 'Identifiant de la recette parente',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column()
  recipeId: string;

  @ManyToOne(() => Recipe, (recipe) => recipe.ingredients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'recipeId' })
  recipe: Recipe;

  @Expose({ groups: ['recipe:read', 'recipe-ingredient:read'] })
  @ApiProperty({
    description: 'Quantité nécessaire',
    example: 4,
  })
  @Column({ type: 'float' })
  quantity: number;

  @Expose({ groups: ['recipe:read', 'recipe-ingredient:read'] })
  @ApiProperty({
    description: 'Unité de mesure',
    example: 'pièce',
  })
  @Column({ type: 'varchar' })
  unit: string;

  @Expose({ groups: ['recipe:read', 'recipe-ingredient:read'] })
  @ApiProperty({
    description: "Indique si l'ingrédient est optionnel",
    example: false,
  })
  @Column({ type: 'boolean', default: false })
  isOptional: boolean;

  @Expose({ groups: ['recipe:read', 'recipe-ingredient:read'] })
  @ApiProperty({
    description: "Identifiant de l'ingrédient générique associé",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column()
  ingredientId: string;

  @ManyToOne(() => Ingredient, { eager: true, nullable: false })
  @JoinColumn({ name: 'ingredientId' })
  ingredient: Ingredient;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
