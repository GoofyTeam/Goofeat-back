import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: "Mot de passe actuel de l'utilisateur",
    example: 'ancienMotDePasse123',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (minimum 6 caractères)',
    example: 'nouveauMotDePasse456',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  newPassword: string;
}
