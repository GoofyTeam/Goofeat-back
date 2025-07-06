/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { classToPlain, ClassTransformOptions } from 'class-transformer';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const SERIALIZATION_GROUP_KEY = 'serializationGroups';

@Injectable()
export class SerializerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const request = context.switchToHttp().getRequest<Request>();
        const groups = this.getSerializationGroups(request);

        return this.serialize(data, { groups });
      }),
    );
  }

  private getSerializationGroups(request: Request): string[] {
    // Récupérer les groupes depuis les headers, query params ou autres
    const groupsFromQuery = request.query.groups as string;
    const groupsFromHeader = request.headers['serialization-groups'] as string;

    // Priorité aux headers, puis aux query params
    const groupsStr = groupsFromHeader || groupsFromQuery;

    if (!groupsStr) {
      return ['default']; // Groupe par défaut
    }

    return groupsStr.split(',').map((g) => g.trim());
  }

  private serialize(data: any, options: ClassTransformOptions): any {
    if (!data) {
      return data;
    }

    // Gérer les tableaux
    if (Array.isArray(data)) {
      return data.map((item) => this.serialize(item, options));
    }

    // Gérer les objets paginés
    if (data.items && Array.isArray(data.items)) {
      return {
        ...data,
        items: data.items.map((item) => this.serialize(item, options)),
      };
    }

    // Transformer l'objet en utilisant class-transformer
    return classToPlain(data, options);
  }
}
