import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../common/mail/mail.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginThrottlingGuard } from './guards/login-throttling.guard';
import { LoginThrottlingService } from './login-throttling.service';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AppleOAuthGuard } from './guards/apple-oauth.guard';
import { AppleStrategy } from './strategies/apple.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        return {
          secret,
          signOptions: {
            // Keep short-lived access tokens when not using refresh tokens
            expiresIn: configService.get<string>('JWT_EXPIRATION') || '15m',
          },
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    AppleStrategy,
    JwtStrategy,
    LocalStrategy,
    LoginThrottlingService,
    LoginThrottlingGuard,
    GoogleOAuthGuard,
    AppleOAuthGuard,
  ],
  exports: [AuthService, JwtModule, JwtStrategy, LocalStrategy],
})
export class AuthModule {}
