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

@Entity('spoonacular_ingredient_mappings')
export class SpoonacularIngredientMapping {
  @Expose({ groups: ['mapping:read'] })
  @ApiProperty({
    description: 'Identifiant unique du mapping',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose({ groups: ['mapping:read'] })
  @ApiProperty({
    description: "ID Spoonacular de l'ingrédient",
    example: 11215,
  })
  @Column({ type: 'int', unique: true })
  spoonacularId: number;

  @Expose({ groups: ['mapping:read'] })
  @ApiProperty({
    description: 'Nom original Spoonacular',
    example: 'garlic',
  })
  @Column({ type: 'varchar' })
  spoonacularName: string;

  @Expose({ groups: ['mapping:read'] })
  @ApiProperty({
    description: "Identifiant de l'ingrédient OpenFoodFacts mappé",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @Column({ type: 'uuid' })
  ingredientId: string;

  @ManyToOne(() => Ingredient, { eager: true, nullable: false })
  @JoinColumn({ name: 'ingredientId' })
  @Expose({ groups: ['mapping:read'] })
  ingredient: Ingredient;

  @Expose({ groups: ['mapping:read'] })
  @ApiProperty({
    description: 'Score de confiance du mapping (0-100)',
    example: 95.5,
    minimum: 0,
    maximum: 100,
  })
  @Column({ type: 'float' })
  confidenceScore: number;

  @Expose({ groups: ['mapping:read'] })
  @ApiProperty({
    description: 'Type de mapping utilisé',
    example: 'exact_match',
    enum: ['exact_match', 'fuzzy_match', 'manual', 'synonym'],
  })
  @Column({ type: 'varchar' })
  mappingType: 'exact_match' | 'fuzzy_match' | 'manual' | 'synonym';

  @Expose({ groups: ['mapping:read', 'admin'] })
  @ApiProperty({
    description: 'Indique si le mapping a été validé manuellement',
    example: true,
  })
  @Column({ type: 'boolean', default: false })
  isValidated: boolean;

  @Expose({ groups: ['mapping:read', 'admin'] })
  @ApiProperty({
    description: 'Nombre de fois que ce mapping a été utilisé',
    example: 42,
  })
  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Expose({ groups: ['admin', 'debug'] })
  @ApiProperty({
    description: 'Données supplémentaires du mapping',
    example: {
      originalSpoonacularData: { aisle: 'Produce', image: 'garlic.jpg' },
      alternativeNames: ['garlic clove', 'fresh garlic'],
    },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  metadata?: any;

  @CreateDateColumn()
  @Expose({ groups: ['mapping:read', 'admin'] })
  createdAt: Date;

  @UpdateDateColumn()
  @Expose({ groups: ['mapping:read', 'admin'] })
  updatedAt: Date;
}
