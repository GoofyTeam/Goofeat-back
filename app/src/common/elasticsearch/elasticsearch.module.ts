import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from 'src/recipes/entities/recipe.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule as NestElasticsearchModule } from '@nestjs/elasticsearch';

import { ElasticsearchService } from './elasticsearch.service';
import { RecipeListener } from './listener/recipe.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recipe]),
    NestElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        node: configService.get<string>(
          'ELASTICSEARCH_HOST',
          'http://localhost:9200',
        ),
        auth: {
          username: configService.get<string>(
            'ELASTICSEARCH_USERNAME',
            'elastic',
          ),
          password: configService.get<string>(
            'ELASTICSEARCH_PASSWORD',
            'elastic',
          ),
        },
        maxRetries: configService.get<number>('ELASTICSEARCH_MAX_RETRIES', 10),
        requestTimeout: configService.get<number>(
          'ELASTICSEARCH_REQUEST_TIMEOUT',
          60000,
        ),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ElasticsearchService, RecipeListener],
  exports: [ElasticsearchService],
})
export class ElasticsearchModule {}
