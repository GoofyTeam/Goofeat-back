import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { LoginThrottlingService } from '../login-throttling.service';

interface LoginRequestBody {
  email: string;
}

interface LoginRequest extends Request {
  body: LoginRequestBody;
}

@Injectable()
export class LoginThrottlingGuard implements CanActivate {
  private readonly logger = new Logger(LoginThrottlingGuard.name);

  constructor(
    private readonly loginThrottlingService: LoginThrottlingService,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<LoginRequest>();
    const email = request.body.email;
    const ip = request.ip;

    const identifier = email || ip;

    if (!identifier) {
      this.logger.warn('No identifier found for login throttling');
      return true;
    }

    if (this.loginThrottlingService.isLocked(identifier)) {
      const remainingTime = Math.ceil(
        this.loginThrottlingService.getRemainingLockTime(identifier) /
          1000 /
          60,
      );

      throw new HttpException(
        `Account locked temporarily, try again in ${remainingTime} minutes`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
