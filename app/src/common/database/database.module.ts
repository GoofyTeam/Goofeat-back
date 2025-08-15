import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as Joi from 'joi';

const validationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().optional(),
  DB_HOST: Joi.string().hostname().optional(),
  DB_PORT: Joi.number().port().optional(),
  DB_USERNAME: Joi.string().optional(),
  DB_PASSWORD: Joi.string().allow('').optional(),
  DB_DATABASE: Joi.string().optional(),
  DB_LOGGING: Joi.string().valid('true', 'false').optional(),
})
  // Exiger soit une URL unique, soit les champs décomposés
  .xor('DATABASE_URL', 'DB_HOST')
  .with('DB_HOST', ['DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE']);

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
      validationSchema: validationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || undefined,
      host: process.env.DB_HOST || undefined,
      port: process.env.DB_PORT
        ? parseInt(process.env.DB_PORT || '5432')
        : undefined,
      username: process.env.DB_USERNAME || undefined,
      password: process.env.DB_PASSWORD || undefined,
      database: process.env.DB_DATABASE || undefined,
      entities: [__dirname + '/../../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../../migrations/*{.ts,.js}'],
      synchronize: true,
      logging: process.env.DB_LOGGING === 'true',
      autoLoadEntities: true,
    }),
  ],
  exports: [TypeOrmModule],
  providers: [TypeOrmModule],
})
export class DatabaseModule {}
