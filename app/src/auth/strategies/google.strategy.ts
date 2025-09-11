import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile,
  Strategy,
  StrategyOptionsWithRequest,
  VerifyCallback,
} from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { OAuthStateManager } from '../utils/oauth-state';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const options: StrategyOptionsWithRequest = {
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') ?? '',
      scope: ['email', 'profile'],
      // We manage state manually without sessions
      passReqToCallback: true,
    };
    super(options);
  }

  async validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    // Verify anti-CSRF state
    const state = (req.query?.state as string) || undefined;
    const secret =
      this.configService.get<string>('OAUTH_STATE_SECRET') ||
      this.configService.get<string>('JWT_SECRET');
    const ok = secret
      ? new OAuthStateManager(secret).verifyAndClear(req, req.res, state)
      : false;
    if (!ok) {
      return done(new UnauthorizedException('Invalid OAuth state'), undefined);
    }
    const { name, emails, photos } = profile;

    const user = await this.authService.findOrCreateOAuthUser({
      provider: 'google',
      providerId: profile.id,
      email: emails?.[0]?.value ?? '',
      firstName: name?.givenName ?? '',
      lastName: name?.familyName ?? '',
      picture: photos?.[0]?.value,
    });

    done(null, user);
  }
}
