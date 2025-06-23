import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './categories/category.module';
import { DatabaseModule } from './common/database/database.module';
import { SeederModule } from './common/database/seeds/seeder.module';
import { ElasticsearchModule } from './common/elasticsearch/elasticsearch.module';
import { LoggerMiddleware } from './common/logger/logger.middleware';
import { LoggerModule } from './common/logger/logger.module';
import { SerializerModule } from './common/serializer/serializer.module';
import { ProductModule } from './products/product.module';
import { RecipeModule } from './recipes/recipe.module';
import { StockModule } from './stocks/stock.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LoggerModule,
    SerializerModule,
    DatabaseModule,
    UsersModule,
    AuthModule,
    CategoryModule,
    ProductModule,
    RecipeModule,
    StockModule,
    EventEmitterModule.forRoot(),
    SeederModule,
    ElasticsearchModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
