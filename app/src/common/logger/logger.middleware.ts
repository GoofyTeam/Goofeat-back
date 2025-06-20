/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { LoggerService } from './logger.service';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly loggerService: LoggerService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    this.loggerService.logRequest(req);
    const startTime = Date.now();

    // Intercepte la méthode d'envoi pour enregistrer la réponse
    const originalSend = res.send;
    const self = this; // Capture de la référence this du middleware

    res.send = function (body): Response {
      // On appelle d'abord la méthode originale
      const result = originalSend.call(this, body);

      // Puis on calcule le temps de traitement après l'envoi
      const responseTime = Date.now() - startTime;
      const logContext = `HTTP Response (${responseTime}ms)`;

      // Enregistre la réponse avec le temps de traitement
      self.loggerService.logResponse(req, res, logContext);

      return result;
    };

    next();
  }
}
