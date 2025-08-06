import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Unit } from 'src/common/units/unit.enums';
import { Household } from 'src/households/entities/household.entity';
import { Product } from 'src/products/entities/product.entity';
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
  @Expose({ groups: ['stock:list', 'stock:read'] })
  id: string;

  @ManyToOne(() => Product, (product) => product.stocks)
  @Expose({ groups: ['stock:list', 'stock:read'] })
  @Type(() => Product)
  product: Product;

  @ManyToOne(() => User, (user) => user.stocks)
  @Expose({ groups: ['stock:read'] })
  @Type(() => User)
  user: User;

  @ManyToOne(() => Household, (household) => household.stocks, {
    nullable: true,
  })
  @Expose({ groups: ['stock:read'] })
  @Type(() => Household)
  household?: Household;

  @ApiProperty({
    description: 'Quantité en stock',
    example: 1.5,
    minimum: 0,
  })
  @Column({ type: 'float' })
  @Expose({ groups: ['stock:list', 'stock:read'] })
  quantity: number;

  @ApiProperty({
    description:
      'Unité de mesure utilisée pour ce stock (surcharge celle du produit si spécifiée)',
    example: 'kg',
    required: false,
  })
  @Column({
    type: 'enum',
    enum: Unit,
    nullable: true,
  })
  @Expose({ groups: ['stock:list', 'stock:read'] })
  unit?: Unit;

  @ApiProperty({
    description: 'Date limite de consommation',
    example: '2025-12-31',
  })
  @Column({ type: 'date' })
  @Expose({ groups: ['stock:list', 'stock:read'] })
  dlc: Date;

  @ApiProperty({
    description: 'Date de création du stock',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  @Expose({ groups: ['stock:read'] })
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour du stock',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  @Expose({ groups: ['stock:read'] })
  updatedAt: Date;

  @ApiProperty({
    description: 'Membre du foyer qui a ajouté ce stock',
  })
  @Column({ type: 'uuid', nullable: true })
  @Expose({ groups: ['stock:read'] })
  addedByMemberId?: string;

  @ApiProperty({
    description: 'Dernière mise à jour effectuée par quel membre',
  })
  @Column({ type: 'uuid', nullable: true })
  @Expose({ groups: ['stock:read'] })
  lastUpdatedByMemberId?: string;
}
