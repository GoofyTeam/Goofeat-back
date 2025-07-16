import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithUser } from 'src/auth/decorators/current-user.decorator';
import { Role } from 'src/users/enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    // Ensure user object and roles exist. If you are using a JWT strategy,
    // the user object should be attached to the request.
    if (!user || !user.roles) {
      return false;
    }
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
