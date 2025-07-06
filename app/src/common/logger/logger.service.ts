/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Inject,
  Injectable,
  LoggerService as NestLoggerService,
} from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  log(message: string, context?: string): void {
    this.logger.info(this.formatMessage(message, context));
  }

  error(message: string, trace?: string, context?: string): void {
    this.logger.error(this.formatMessage(message, context), { trace });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(this.formatMessage(message, context));
  }

  debug(message: string, context?: string): void {
    this.logger.debug(this.formatMessage(message, context));
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(this.formatMessage(message, context));
  }

  private formatMessage(message: string, context?: string): string {
    return context ? `[${context}] ${message}` : message;
  }

  /**
   * Enregistre une requête HTTP entrante
   */
  logRequest(req: any, context?: string): void {
    const message = `${req.method} ${req.url}`;
    this.log(message, context || 'HTTP Request');
  }

  /**
   * Enregistre une réponse HTTP sortante
   */
  logResponse(req: any, res: any, context?: string): void {
    const message = `${req.method} ${req.url} ${res.statusCode}`;
    this.log(message, context || 'HTTP Response');
  }

  /**
   * Enregistre une opération de base de données
   */
  logDatabase(
    operation: string,
    entity: string,
    result: any,
    context?: string,
  ): void {
    const message = `${operation} ${entity}: ${JSON.stringify(result)}`;
    this.debug(message, context || 'Database');
  }

  /**
   * Enregistre une erreur avec des détails supplémentaires
   */
  logException(exception: Error, context?: string): void {
    this.error(`${exception.message}`, exception.stack, context || 'Exception');
  }
}
