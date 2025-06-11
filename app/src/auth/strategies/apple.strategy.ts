import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy, StrategyOptions } from 'passport-apple';
import { User } from '../../users/entity/user.entity';
import { AuthService, OAuthUser } from '../auth.service';

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
