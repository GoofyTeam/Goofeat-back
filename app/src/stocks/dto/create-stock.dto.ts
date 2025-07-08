/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// Décorateur personnalisé pour vérifier qu'au moins un des champs est renseigné
export function IsRequiredIfOtherIsMissing(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: any, propertyName: string) {
    registerDecorator({
      name: 'isRequiredIfOtherIsMissing',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          // Accès sécurisé au premier élément du tableau constraints
          const relatedPropertyName = args.constraints[0] as string;
          const relatedValue = (args.object as any)[
            relatedPropertyName
          ] as string;

          if (value !== undefined && value !== null && value !== '') {
            return true;
          }

          return (
            relatedValue !== undefined &&
            relatedValue !== null &&
            relatedValue !== ''
          );
        },
        defaultMessage(args: ValidationArguments) {
          // Accès sécurisé au premier élément du tableau constraints
          const relatedPropertyName = args.constraints[0] as string;
          return `Au moins l'un des champs ${args.property} ou ${relatedPropertyName} doit être renseigné`;
        },
      },
    });
  };
}

export class CreateStockDto {
  @ApiProperty({
    description: 'Identifiant du produit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @IsRequiredIfOtherIsMissing('categoryId', {
    message: "productId est requis si categoryId n'est pas fourni",
  })
  productId?: string;

  @ApiProperty({
    description: 'Identifiant de la catégorie',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @IsRequiredIfOtherIsMissing('productId', {
    message: "categoryId est requis si productId n'est pas fourni",
  })
  categoryId?: string;

  @ApiProperty({
    description: "Identifiant de l'utilisateur propriétaire du stock",
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Quantité en stock',
    example: 1.5,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @ApiProperty({
    description: 'Date limite de consommation',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dlc?: Date;
}
