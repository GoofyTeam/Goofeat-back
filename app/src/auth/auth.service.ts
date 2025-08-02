import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
    const newUser = await this.usersService.create({
      email,
      password: password, // Passer le mot de passe en clair
      firstName,
      lastName,
    });

    return newUser;
  }
}
