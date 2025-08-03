/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { MailService } from '../common/mail/mail.service';
import { User } from '../users/entity/user.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './interfaces/jwt-payload.interface';

export type AuthProvider = 'google' | 'apple';

export interface OAuthUser {
  email: string;
  firstName: string;
  lastName: string;
  providerId: string;
  provider: AuthProvider;
  picture?: string;
}

interface PasswordResetToken {
  token: string;
  email: string;
  expiresAt: Date;
}

interface EmailVerificationToken {
  token: string;
  email: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private passwordResetTokens = new Map<string, PasswordResetToken>();
  private emailVerificationTokens = new Map<string, EmailVerificationToken>();

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async validateOAuthUser(profile: OAuthUser): Promise<User> {
    let user = await this.usersService.findOneByEmail(profile.email);

    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        password: '', // Le mot de passe n'est pas nécessaire pour l'authentification OAuth
      });

      await this.usersService.updateEmailVerification(user.id, true);
    }

    if (profile.provider === 'google') {
      user.googleId = profile.providerId;
    }
    if (profile.provider === 'apple') {
      user.appleId = profile.providerId;
    }
    if (profile.picture) {
      user.profilePicture = profile.picture;
    }

    return user;
  }

  generateJwtToken(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    return this.jwtService.sign(payload);
  }

  async validateJwtPayload(payload: JwtPayload): Promise<User | null> {
    return this.usersService.findOneByEmail(payload.email);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        "Ce compte utilise l'authentification sociale",
      );
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Veuillez vérifier votre email avant de vous connecter',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Mot de passe incorrect');
    }

    return user;
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ): Promise<User> {
    const existingUser = await this.usersService.findOneByEmail(email);

    if (existingUser) {
      throw new UnauthorizedException('Cet email est déjà utilisé');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await this.usersService.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      isEmailVerified: false,
    });

    // Envoyer l'email de bienvenue et de vérification
    const verificationToken = this.generateEmailVerificationToken(email);
    await this.mailService.sendWelcomeEmail(newUser);
    await this.mailService.sendEmailVerification(newUser, verificationToken);

    return newUser;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      return;
    }

    const token = this.generatePasswordResetToken(email);
    await this.mailService.sendPasswordResetEmail(user, token);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = this.passwordResetTokens.get(token);

    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new BadRequestException(
        'Token de réinitialisation invalide ou expiré',
      );
    }

    const user = await this.usersService.findOneByEmail(resetToken.email);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);
    this.passwordResetTokens.delete(token);
  }

  async verifyEmail(token: string): Promise<void> {
    const verificationToken = this.emailVerificationTokens.get(token);

    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Token de vérification invalide ou expiré');
    }

    const user = await this.usersService.findOneByEmail(
      verificationToken.email,
    );
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    await this.usersService.updateEmailVerification(user.id, true);
    this.emailVerificationTokens.delete(token);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      return;
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Cet email est déjà vérifié');
    }

    const verificationToken = this.generateEmailVerificationToken(email);
    await this.mailService.sendEmailVerification(user, verificationToken);
  }

  private generatePasswordResetToken(email: string): string {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expire dans 1 heure

    this.passwordResetTokens.set(token, {
      token,
      email,
      expiresAt,
    });

    return token;
  }

  private generateEmailVerificationToken(email: string): string {
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1); // Expire dans 24 heures

    this.emailVerificationTokens.set(token, {
      token,
      email,
      expiresAt,
    });

    return token;
  }
}
