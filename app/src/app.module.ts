import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './common/database/database.module';
import { ElasticsearchModule } from './common/elasticsearch/elasticsearch.module';
import { ExternalApisModule } from './common/external-apis/external-apis.module';
import { LoggerMiddleware } from './common/logger/logger.middleware';
import { LoggerModule } from './common/logger/logger.module';
import { SerializerModule } from './common/serializer/serializer.module';
import { UnitsModule } from './common/units/units.module';
import { HouseholdModule } from './households/household.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ProductModule } from './products/product.module';
import { RecipeModule } from './recipes/recipe.module';
import { StockModule } from './stocks/stock.module';
import { UsersModule } from './users/users.module';
import { CommandsModule } from './commands/commands.module';
import { OcrReceiptModule } from './ocr-receipt/ocr-receipt.module';

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
    IngredientsModule,
    ProductModule,
    RecipeModule,
    StockModule,
    HouseholdModule,
    NotificationsModule,
    EventEmitterModule.forRoot(),
    ElasticsearchModule,
    ExternalApisModule,
    UnitsModule,
    CommandsModule,
    OcrReceiptModule,
    MailerModule.forRootAsync({
      useFactory: () => {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = Number(process.env.SMTP_PORT ?? 587);
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASSWORD;
        const hasSmtp = Boolean(smtpHost);
        const useAuth = Boolean(smtpUser && smtpPass);

        const transport = hasSmtp
          ? {
              host: smtpHost,
              port: smtpPort,
              secure: false,
              ...(useAuth
                ? {
                    auth: {
                      user: smtpUser as string,
                      pass: smtpPass as string,
                    },
                  }
                : {}),
            }
          : {
              // Dev fallback: do not attempt network connection; log as JSON
              jsonTransport: true,
            };

        return {
          transport,
          defaults: {
            from: process.env.SMTP_FROM,
          },
          template: {
            dir: process.cwd() + '/templates',
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  // controllers: process.env.NODE_ENV !== 'production' ? [AppController] : [],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
