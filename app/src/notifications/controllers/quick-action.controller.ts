import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Response } from 'express';
import { Repository } from 'typeorm';
import { Stock } from '../../stocks/entities/stock.entity';
import { User } from '../../users/entity/user.entity';

interface QuickActionToken {
  stockId: string;
  userId: string;
  action: string;
  type: string;
  exp?: number;
}

@ApiTags('notifications')
@Controller('notifications/quick-action')
export class QuickActionController {
  private readonly logger = new Logger(QuickActionController.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Get('delete')
  @ApiOperation({
    summary: 'Supprimer un stock via action rapide depuis email',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: "Token JWT pour l'action rapide",
  })
  @ApiResponse({
    status: 200,
    description: "Stock supprimé avec succès et redirection vers l'application",
  })
  @ApiResponse({
    status: 400,
    description: 'Token invalide ou expiré',
  })
  @ApiResponse({
    status: 404,
    description: 'Stock non trouvé',
  })
  async deleteStockQuickAction(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      // Vérifier et décoder le token
      if (!token) {
        return this.sendHtmlResponse(res, 'error', 'Token manquant', 400);
      }

      let decoded: QuickActionToken;
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const rawDecoded = this.jwtService.verify(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        decoded = rawDecoded as QuickActionToken;
      } catch (error) {
        this.logger.warn('Token invalide ou expiré:', error);
        return this.sendHtmlResponse(
          res,
          'error',
          'Token invalide ou expiré',
          400,
        );
      }

      // Vérifier que c'est bien une action de type quick_action
      if (decoded.type !== 'quick_action' || decoded.action !== 'delete') {
        this.logger.warn("Type d'action invalide:", decoded);
        return this.sendHtmlResponse(res, 'error', 'Action non autorisée', 403);
      }

      // Vérifier que l'utilisateur existe
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId },
      });

      if (!user) {
        this.logger.warn('Utilisateur non trouvé:', decoded.userId);
        return this.sendHtmlResponse(
          res,
          'error',
          'Utilisateur non trouvé',
          404,
        );
      }

      // Vérifier que le stock existe et appartient à l'utilisateur
      const stock = await this.stockRepository.findOne({
        where: {
          id: decoded.stockId,
          user: { id: decoded.userId },
        },
        relations: ['product'],
      });

      if (!stock) {
        this.logger.warn(
          `Stock non trouvé ou n'appartient pas à l'utilisateur: ${decoded.stockId}`,
        );
        return this.sendHtmlResponse(
          res,
          'info',
          'Ce produit a déjà été supprimé',
          200,
        );
      }

      const productName = stock.product?.name || 'Produit';

      // Supprimer le stock
      await this.stockRepository.remove(stock);

      this.logger.log(
        `Stock ${decoded.stockId} supprimé avec succès via action rapide par l'utilisateur ${user.email}`,
      );

      return this.sendHtmlResponse(
        res,
        'success',
        `${productName} a été supprimé de votre stock avec succès !`,
        200,
      );
    } catch (error) {
      this.logger.error('Erreur lors de la suppression rapide:', error);
      return this.sendHtmlResponse(
        res,
        'error',
        'Une erreur est survenue',
        500,
      );
    }
  }

  @Get('verify')
  @ApiOperation({ summary: "Vérifier la validité d'un token d'action rapide" })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Token JWT à vérifier',
  })
  @ApiResponse({
    status: 200,
    description: 'Token valide',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        stockId: { type: 'string' },
        userId: { type: 'string' },
        action: { type: 'string' },
        expiresAt: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Token invalide ou expiré',
  })
  verifyQuickActionToken(@Query('token') token: string) {
    try {
      if (!token) {
        throw new BadRequestException('Token manquant');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const rawDecoded = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const decoded = rawDecoded as QuickActionToken;

      // Vérifier que c'est bien un token d'action rapide
      if (decoded.type !== 'quick_action') {
        throw new BadRequestException('Type de token invalide');
      }

      return {
        valid: true,
        stockId: decoded.stockId,
        userId: decoded.userId,
        action: decoded.action,
        expiresAt: decoded.exp
          ? new Date(decoded.exp * 1000).toISOString()
          : 'Unknown',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Token invalide ou expiré');
    }
  }

  /**
   * Envoie une réponse HTML simple au lieu de rediriger vers une app
   */
  private sendHtmlResponse(
    res: Response,
    type: 'success' | 'error' | 'info',
    message: string,
    statusCode: number,
  ): void {
    const colors = {
      success: { bg: '#d4edda', border: '#c3e6cb', text: '#155724' },
      error: { bg: '#f8d7da', border: '#f5c6cb', text: '#721c24' },
      info: { bg: '#d1ecf1', border: '#bee5eb', text: '#0c5460' },
    };

    const color = colors[type];
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Goofeat - Action rapide</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0; 
          padding: 20px; 
          background-color: #f5f5f5; 
        }
        .container { 
          max-width: 500px; 
          margin: 50px auto; 
          background: white; 
          border-radius: 10px; 
          box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
          overflow: hidden; 
        }
        .header { 
          background: #2c3e50; 
          color: white; 
          padding: 20px; 
          text-align: center; 
        }
        .content { 
          padding: 30px; 
          text-align: center; 
        }
        .message { 
          background: ${color.bg}; 
          border: 1px solid ${color.border}; 
          color: ${color.text}; 
          padding: 15px; 
          border-radius: 5px; 
          margin: 20px 0; 
        }
        .icon { 
          font-size: 48px; 
          margin-bottom: 15px; 
        }
        .note { 
          color: #6c757d; 
          font-size: 14px; 
          margin-top: 20px; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍽️ Goofeat</h1>
        </div>
        <div class="content">
          <div class="icon">${icon}</div>
          <div class="message">
            <strong>${message}</strong>
          </div>
          <div class="note">
            Cette action a été effectuée depuis votre email.<br>
            Vous pouvez fermer cette page.
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

    res.status(statusCode).type('html').send(html);
  }
}
