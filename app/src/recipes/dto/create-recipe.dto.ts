import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { CreateRecipeIngredientDto } from './create-recipe-ingredient.dto';

// niveaux de difficulté
export enum Difficulty {
  EASY = 'Facile',
  INTERMEDIATE = 'Intermédiaire',
  DIFFICULT = 'Difficile',
  EXPERT = 'Expert',
}

// scores nutritionnels
export enum NutriScore {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  E = 'E',
}

export class CreateRecipeDto {
  @ApiProperty({
    description: 'Nom de la recette',
    example: 'Tarte aux pommes',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Description détaillée de la recette',
    example: 'Une délicieuse tarte aux pommes familiale',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({
    description: "URL de l'image de la recette",
    example: 'https://example.com/images/tarte-aux-pommes.jpg',
  })
  @IsNotEmpty()
  @IsString()
  @IsUrl()
  imageUrl: string;

  @ApiProperty({
    description: 'Temps de préparation en minutes',
    example: 30,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  preparationTime: number;

  @ApiProperty({
    description: 'Temps de cuisson en minutes',
    example: 45,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cookingTime: number;

  @ApiProperty({
    description: 'Nombre de portions',
    example: 4,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  servings: number;

  @ApiProperty({
    description: 'Difficulté de la recette',
    example: Difficulty.EASY,
    enum: Difficulty,
  })
  @IsNotEmpty()
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiProperty({
    description: 'Score nutritionnel global',
    example: NutriScore.A,
    enum: NutriScore,
  })
  @IsNotEmpty()
  @IsEnum(NutriScore)
  nutriScore: NutriScore;

  @ApiProperty({
    description: 'Catégories de la recette',
    example: ['Dessert', 'Fruit', 'Sucré'],
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  categories: string[];

  @ApiProperty({
    description: 'Ingrédients nécessaires',
    type: [CreateRecipeIngredientDto],
    minItems: 1,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateRecipeIngredientDto)
  ingredients: CreateRecipeIngredientDto[];
}
