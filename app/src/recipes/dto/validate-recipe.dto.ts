import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsPositive, IsString, IsUUID, Min } from 'class-validator';

export class ValidateRecipeDto {
  @ApiProperty({
    description: 'Nombre de personnes pour ajuster les quantités',
    example: 6,
    minimum: 1,
  })
  @IsPositive({ message: 'Le nombre de personnes doit être positif' })
  @Min(1, { message: 'Au moins 1 personne est requise' })
  servings: number;

  @ApiProperty({
    description: 'Note ou commentaire sur la préparation (optionnel)',
    example: 'Excellente recette, ajouté plus de sel',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'ID du foyer pour utiliser le stock spécifique (optionnel)',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: "L'ID du foyer doit être un UUID valide" })
  householdId?: string;
}
