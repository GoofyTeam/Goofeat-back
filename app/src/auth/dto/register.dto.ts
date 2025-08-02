import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: "Email de l'utilisateur",
    example: 'user@example.com',
    required: true,
  })
  @IsEmail({}, { message: 'Veuillez fournir un email valide' })
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;

  @ApiProperty({
    description: 'Mot de passe',
    example: 'password123',
    minLength: 6,
    required: true,
  })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères',
  })
  password: string;

  @ApiProperty({
    description: 'Prénom',
    example: 'Jean',
    required: true,
  })
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le prénom est requis' })
  firstName: string;

  @ApiProperty({
    description: 'Nom',
    example: 'Dupont',
    required: true,
  })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom est requis' })
  lastName: string;
}
