import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';
import { LoginThrottlingService } from '../login-throttling.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottlingService: LoginThrottlingService,
  ) {
    super({
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    try {
      const user = await this.authService.validateUser(email, password);

      // Réinitialiser le compteur en cas de succès
      this.loginThrottlingService.resetAttempts(email);

      return user;
    } catch (error) {
      // Enregistrer la tentative échouée
      const remainingAttempts =
        this.loginThrottlingService.registerFailedAttempt(email);

      if (remainingAttempts > 0) {
        throw new UnauthorizedException(
          `Identifiants invalides. Il vous reste ${remainingAttempts} tentative(s).`,
        );
      } else {
        // Le garde LoginThrottlingGuard bloquera la prochaine tentative
        throw new UnauthorizedException(
          'Identifiants invalides. Prochaine tentative pourrait verrouiller votre compte.',
        );
      }
    }
  }
}
