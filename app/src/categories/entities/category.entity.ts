import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Ingredient } from 'src/ingredients/entities/ingredient.entity';
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

@Entity('categories')
export class Category {
  @Expose({ groups: ['default', 'category:read', 'category:list'] })
  @ApiProperty({
    description: 'Identifiant unique de la catégorie',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Expose({ groups: ['default', 'category:read', 'category:list'] })
  @ApiProperty({
    description: 'Nom de la catégorie',
    example: 'Produits laitiers',
  })
  @Column({ type: 'varchar' })
  name: string;

  @Expose({ groups: ['default', 'category:read'] })
  @ApiProperty({
    description: 'Description de la catégorie',
    example:
      'Tous types de produits laitiers comme le lait, fromage, yaourt, etc.',
  })
  @Column({ type: 'varchar', nullable: true })
  description: string;

  @Expose({ groups: ['default', 'category:read', 'category:list'] })
  @ApiProperty({
    description: "URL de l'icône de la catégorie",
    example: 'https://example.com/icons/dairy.png',
  })
  @Column({ type: 'varchar', nullable: true })
  iconUrl?: string;

  @Expose({ groups: ['category:read'] })
  @ApiProperty({
    description: 'Catégorie parente',
    type: () => Category,
    required: false,
  })
  @ManyToOne(() => Category, (category) => category.children, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent: Category;

  @Column({ type: 'uuid', nullable: true })
  parentId: string;

  @Expose({ groups: ['category:read'] })
  @ApiProperty({
    description: 'Sous-catégories',
    type: () => [Category],
    required: false,
  })
  @OneToMany(() => Category, (category) => category.parent, {
    cascade: true,
  })
  children: Category[];

  @OneToMany(() => Ingredient, (ingredient) => ingredient.category)
  ingredients: Ingredient[];

  @Expose({ groups: ['category:read', 'admin'] })
  @ApiProperty({
    description: 'Date de création',
    example: '2023-01-01T00:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @Expose({ groups: ['category:read', 'admin'] })
  @ApiProperty({
    description: 'Date de dernière mise à jour',
    example: '2023-01-01T00:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
