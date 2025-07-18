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
import { Reflector } from '@nestjs/core';
import { ClassTransformOptions, instanceToPlain } from 'class-transformer';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export const SERIALIZATION_GROUP_KEY = 'serializationGroups';

@Injectable()
export class SerializerInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const handlerGroups = this.reflector.get<string[]>(
      SERIALIZATION_GROUP_KEY,
      context.getHandler(),
    );

    const classGroups = this.reflector.get<string[]>(
      SERIALIZATION_GROUP_KEY,
      context.getClass(),
    );

    const request = context.switchToHttp().getRequest<Request>();

    let groups: string[] | undefined = this.getSerializationGroups(request);
    if (!groups || groups.length === 0 || (groups.length === 1 && !groups[0])) {
      groups = handlerGroups || classGroups || ['default'];
    }

    return next.handle().pipe(
      map((data) => {
        return this.serialize(data, { groups });
      }),
    );
  }

  private getSerializationGroups(request: Request): string[] | undefined {
    const groupsFromQuery = request.query.groups as string;
    const groupsFromHeader = request.headers['serialization-groups'] as string;
    const groupsStr = groupsFromHeader || groupsFromQuery;

    if (!groupsStr) {
      return undefined;
    }
    return groupsStr.split(',').map((g) => g.trim());
  }
  private serialize(data: any, options: ClassTransformOptions): any {
    if (!data) {
      return data;
    }

    console.log('Options class-transformer:', options);

    if (Array.isArray(data)) {
      return data.map((item) => this.serialize(item, options));
    }

    if (data.items && Array.isArray(data.items)) {
      return {
        ...data,
        items: data.items.map((item) => this.serialize(item, options)),
      };
    }

    const result = instanceToPlain(data, options);

    return result;
  }
}
