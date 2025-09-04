import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { OAuthStateManager } from '../utils/oauth-state';
import { Response } from 'express';

@Injectable()
export class AppleOAuthGuard extends AuthGuard('apple') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const http = context.switchToHttp();
    const res: Response = http.getResponse();

    const secret =
      this.configService.get<string>('OAUTH_STATE_SECRET') ||
      this.configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET environment variable is required');

    const state = new OAuthStateManager(secret).mint(res);
    return {
      scope: ['email', 'name'],
      state,
    };
  }
}
