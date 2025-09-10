import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '../users/entity/user.entity';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LoginThrottlingGuard } from './guards/login-throttling.guard';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AppleOAuthGuard } from './guards/apple-oauth.guard';
import { Response } from 'express';

interface RequestWithUser extends Request {
  user: User;
}

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private handleOAuthRedirect(req: RequestWithUser, res: Response) {
    const user = req.user;
    const token = this.authService.generateJwtToken(user);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
    const base = frontendUrl.replace(/\/$/, '');

    const redirectUrl = `${base}/oauth/callback#access_token=${encodeURIComponent(
      token,
    )}`;

    return res.redirect(redirectUrl);
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Authentification Google OAuth' })
  async googleAuth() {
    // Cette méthode ne sera pas exécutée,
    // car le garde d'authentification redirigera vers Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback Google OAuth' })
  @ApiResponse({ status: 200, description: 'Connexion réussie avec Google' })
  googleAuthRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    return this.handleOAuthRedirect(req, res);
  }

  @Get('apple')
  @UseGuards(AppleOAuthGuard)
  @ApiOperation({ summary: 'Authentification Apple OAuth' })
  async appleAuth() {
    // Cette méthode ne sera pas exécutée,
    // car le garde d'authentification redirigera vers Apple
  }

  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  @ApiOperation({ summary: 'Callback Apple OAuth' })
  @ApiResponse({ status: 200, description: 'Connexion réussie avec Apple' })
  appleAuthRedirect(@Req() req: RequestWithUser, @Res() res: Response) {
    return this.handleOAuthRedirect(req, res);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Obtenir le profil utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur récupéré avec succès',
  })
  getProfile(@Req() req: RequestWithUser) {
    return req.user;
  }

  @Post('register')
  @ApiOperation({ summary: "Inscription d'un nouvel utilisateur" })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  async register(@Body() registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;
    const user = await this.authService.register(
      email,
      password,
      firstName,
      lastName,
    );
    const token = this.authService.generateJwtToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LoginThrottlingGuard, AuthGuard('local'))
  @ApiBody({ type: LoginDto })
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({ status: 200, description: 'Connexion réussie' })
  login(@Body() loginDto: LoginDto, @Req() req: RequestWithUser) {
    const user = req.user;
    const token = this.authService.generateJwtToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Demande de réinitialisation de mot de passe' })
  @ApiResponse({ status: 200, description: 'Email de réinitialisation envoyé' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto.email);
    return {
      message:
        'Si un compte existe avec cet email, un lien de réinitialisation vous sera envoyé.',
    };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialisation de mot de passe' })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe réinitialisé avec succès',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
    return { message: 'Votre mot de passe a été réinitialisé avec succès.' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Renvoyer l'email de vérification" })
  @ApiResponse({ status: 200, description: 'Email de vérification renvoyé' })
  async resendVerificationEmail(@Body() body: { email: string }) {
    await this.authService.resendVerificationEmail(body.email);
    return { message: 'Email de vérification renvoyé avec succès.' };
  }

  @Get('verify-email')
  @ApiOperation({ summary: "Vérification d'email" })
  @ApiQuery({ name: 'token', description: 'Token de vérification' })
  @ApiResponse({ status: 200, description: 'Email vérifié avec succès' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Votre email a été vérifié avec succès.' };
  }

  @Post('google')
  @ApiOperation({ summary: 'Authentification Google avec token ID' })
  @ApiResponse({ status: 200, description: 'Authentification réussie' })
  async googleMobileAuth(@Body() body: { tokenId: string }) {
    const user = await this.authService.verifyGoogleTokenId(body.tokenId);
    const token = this.authService.generateJwtToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
    };
  }

  @Post('apple')
  @ApiOperation({ summary: 'Authentification Apple avec token ID' })
  @ApiResponse({ status: 200, description: 'Authentification réussie' })
  async appleAuthmobile(
    @Body() body: { tokenId: string; firstName?: string; lastName?: string },
  ) {
    const user = await this.authService.verifyAppleTokenId(body.tokenId, {
      firstName: body.firstName,
      lastName: body.lastName,
    });
    const token = this.authService.generateJwtToken(user);

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
    };
  }
}
