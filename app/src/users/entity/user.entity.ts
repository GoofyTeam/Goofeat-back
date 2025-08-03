import { Expose } from 'class-transformer';
import { Stock } from 'src/stocks/entities/stock.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../enums/role.enum';
import { UserPreferences } from '../interfaces/user-preferences.interface';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @Expose({ groups: ['user:list', 'user:read'] })
  id: string;

  @Column({ length: 100 })
  @Expose({ groups: ['user:list', 'user:read'] })
  firstName: string;

  @Column({ length: 100 })
  @Expose({ groups: ['user:list', 'user:read'] })
  lastName: string;

  @Column({ unique: true })
  @Expose({ groups: ['user:read'] })
  email: string;

  @Column({ select: false, nullable: true })
  password: string;

  @Column({ default: true })
  @Expose({ groups: ['user:read', 'user:admin'] })
  isActive: boolean;

  @Column({ nullable: true })
  googleId: string;

  @Column({ nullable: true })
  appleId: string;

  @Column({ nullable: true })
  @Expose({ groups: ['user:list', 'user:read'] })
  profilePicture: string;

  @CreateDateColumn()
  @Expose({ groups: ['user:read', 'user:admin'] })
  createdAt: Date;

  @UpdateDateColumn()
  @Expose({ groups: ['user:read', 'user:admin'] })
  updatedAt: Date;

  @OneToMany(() => Stock, (stock) => stock.user)
  @Expose({ groups: ['user:read'] })
  stocks: Stock[];

  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'{}'",
    array: false,
  })
  @Expose({ groups: ['user:read'] })
  preferences: UserPreferences;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'{}'",
    array: false,
  })
  @Expose({ groups: ['user:read'] })
  notificationSettings: Record<string, unknown>;

  @Column({ type: 'varchar', nullable: true })
  fcmToken?: string | null;

  @Column({ default: false })
  @Expose({ groups: ['user:read', 'user:admin'] })
  isEmailVerified: boolean;

  @Column({
    type: 'simple-array',
    enum: Role,
    default: [Role.USER],
  })
  @Expose({ groups: ['user:read', 'user:admin'] })
  roles: Role[];
}
