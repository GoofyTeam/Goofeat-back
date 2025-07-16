import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { User } from '../../users/entity/user.entity';

export interface RequestWithUser extends Request {
  user: User;
}

/**
 * Décorateur pour récupérer l'utilisateur connecté à partir de la requête
 * Utilisation: @CurrentUser() user: User
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    // Utilisation d'une assertion de type sécurisée
    const user = request.user;
    return user;
  },
);
