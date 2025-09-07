/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, StrategyOptions } from 'passport-apple';
import { User } from '../../users/entity/user.entity';
import { AuthService, OAuthUser } from '../auth.service';
import { OAuthStateManager } from '../utils/oauth-state';

@Injectable()
export class AppleStrategy extends PassportStrategy(Strategy, 'apple') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const options: StrategyOptions = {
      clientID: configService.get<string>('APPLE_CLIENT_ID') ?? '',
      teamID: configService.get<string>('APPLE_TEAM_ID') ?? '',
      keyID: configService.get<string>('APPLE_KEY_ID') ?? '',
      privateKeyLocation:
        configService.get<string>('APPLE_PRIVATE_KEY_PATH') ?? '',
      callbackURL: configService.get<string>('APPLE_CALLBACK_URL') ?? '',
      scope: ['email', 'name'],
      passReqToCallback: true,
      // We'll inject `state` at runtime via guard and verify here
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super(options);
  }

  async validate(
    req: Request & {
      body?: {
        user?: {
          email?: string;
          name?: { firstName?: string; lastName?: string };
          id?: string;
        };
      };
    },

    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: { email?: string; id?: string },
    done: (error: Error | null, user?: User | null) => void,
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
      return done(new UnauthorizedException('Invalid OAuth state'));
    }

    // Apple ne fournit pas toujours les informations de profil
    // Les informations sont généralement disponibles uniquement lors de la première connexion
    // Nous devons donc les extraire du token ou de la requête

    // Essayer d'extraire les informations du token ou de la requête
    const userEmail: string | undefined =
      profile?.email || req.body?.user?.email || undefined;

    // Les informations de nom peuvent être dans req.body.user.name
    const firstName = req.body?.user?.name?.firstName || '';
    const lastName = req.body?.user?.name?.lastName || '';

    if (!userEmail) {
      return done(new Error('Aucun email fourni par Apple'), null);
    }

    const user: OAuthUser = {
      email: userEmail,
      firstName,
      lastName,
      providerId: profile?.id || req.body?.user?.id || '',
      provider: 'apple',
    };

    const validatedUser = await this.authService.validateOAuthUser(user);
    done(null, validatedUser);
  }
}
