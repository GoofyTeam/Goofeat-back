import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Category } from 'src/categories/entities/category.entity';
import { Product } from 'src/products/entities/product.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @Expose({ groups: ['default', 'ingredient:read'] })
  @ApiProperty({
    description: "Identifiant unique de l'ingrédient",
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose({ groups: ['default', 'ingredient:read'] })
  @ApiProperty({
    description: "Nom de l'ingrédient générique",
    example: 'Farine de blé',
  })
  @Column({ type: 'varchar', unique: true })
  name: string;

  @Expose({ groups: ['ingredient:read'] })
  @ApiProperty({
    description: 'Identifiant de la catégorie parente',
  })
  @Column()
  categoryId: string;

  @ManyToOne(() => Category, {
    eager: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: Category;

  @OneToMany(() => Product, (product) => product.ingredient)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
