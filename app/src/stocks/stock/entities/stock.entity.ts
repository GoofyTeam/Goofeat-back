import { ApiProperty } from '@nestjs/swagger';
import { Product } from 'src/products/product/entities/product.entity';
import { User } from 'src/users/entity/user.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('stocks')
export class Stock {
  @ApiProperty({
    description: 'Identifiant unique du stock',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.stocks)
  product: Product;

  @ManyToOne(() => User, (user) => user.stocks)
  user: User;

  @ApiProperty({
    description: 'Quantité en stock',
    example: 1.5,
    minimum: 0,
  })
  @Column({ type: 'float' })
  quantity: number;

  @ApiProperty({
    description: 'Date limite de consommation',
    example: '2025-12-31',
  })
  @Column({ type: 'date' })
  dlc: Date;

  @ApiProperty({
    description: 'Date de création du stock',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour du stock',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
