import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Stock } from 'src/stocks/entities/stock.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HouseholdType } from '../enums/household-type.enum';
import { HouseholdMember } from './household-member.entity';

@Entity('households')
export class Household {
  @ApiProperty({
    description: 'Identifiant unique du foyer',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @PrimaryGeneratedColumn('uuid')
  @Expose({ groups: ['household:list', 'household:read'] })
  id: string;

  @ApiProperty({
    description: 'Nom du foyer',
    example: 'Famille Durand',
  })
  @Column({ length: 100 })
  @Expose({ groups: ['household:list', 'household:read'] })
  name: string;

  @ApiProperty({
    description: 'Type de foyer',
    enum: HouseholdType,
    example: HouseholdType.FAMILY,
  })
  @Column({
    type: 'enum',
    enum: HouseholdType,
    default: HouseholdType.SINGLE,
  })
  @Expose({ groups: ['household:list', 'household:read'] })
  type: HouseholdType;

  @ApiProperty({
    description: "Code d'invitation pour rejoindre le foyer",
    example: 'ABC123',
  })
  @Column({ length: 10, unique: true, nullable: true })
  @Expose({ groups: ['household:read'] })
  inviteCode?: string;

  @ApiProperty({
    description: "Date d'expiration du code d'invitation",
  })
  @Column({ type: 'timestamp', nullable: true })
  @Expose({ groups: ['household:read'] })
  inviteCodeExpiresAt?: Date;

  @ApiProperty({
    description: 'Description du foyer',
    example: 'Notre petite famille de 4 personnes',
  })
  @Column({ type: 'text', nullable: true })
  @Expose({ groups: ['household:read'] })
  description?: string;

  @ApiProperty({
    description: 'Paramètres du foyer',
    example: { notifications: { familyAlerts: true } },
  })
  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'{}'",
  })
  @Expose({ groups: ['household:read'] })
  settings?: Record<string, unknown>;

  @ApiProperty({
    description: 'Foyer actif ou non',
    example: true,
  })
  @Column({ default: true })
  @Expose({ groups: ['household:read'] })
  isActive: boolean;

  @OneToMany(() => HouseholdMember, (member) => member.household, {
    cascade: true,
  })
  @Expose({ groups: ['household:read'] })
  @Type(() => HouseholdMember)
  members: HouseholdMember[];

  @OneToMany(() => Stock, (stock) => stock.household)
  @Expose({ groups: ['household:read'] })
  @Type(() => Stock)
  stocks: Stock[];

  @ApiProperty({
    description: 'Date de création du foyer',
  })
  @CreateDateColumn()
  @Expose({ groups: ['household:read'] })
  createdAt: Date;

  @ApiProperty({
    description: 'Date de dernière mise à jour',
  })
  @UpdateDateColumn()
  @Expose({ groups: ['household:read'] })
  updatedAt: Date;
}
