import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FilterStockDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search by product name',
    example: 'Milk',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
