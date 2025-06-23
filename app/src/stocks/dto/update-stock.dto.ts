import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsDate, IsNumber, IsOptional, IsUUID } from 'class-validator';
import { CreateStockDto, IsRequiredIfOtherIsMissing } from './create-stock.dto';

export class UpdateStockDto extends PartialType(CreateStockDto) {
  @ApiProperty({
    description: 'Date limite de consommation',
    example: '2025-12-31',
    required: false,
  })
  @IsOptional()
  @IsDate()
  dlc?: Date;

  @ApiProperty({
    description: 'Quantité en stock',
    example: 1.5,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({
    description: 'Identifiant du produit',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  @IsRequiredIfOtherIsMissing('categoryId', {
    message: "productId est requis si userId n'est pas fourni",
  })
  productId?: string;

  @ApiProperty({
    description: 'Identifiant de la catégorie',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    required: false,
  })
  @IsOptional()
  @IsRequiredIfOtherIsMissing('productId', {
    message: "productId est requis si userId n'est pas fourni",
  })
  categoryId?: string;
}
