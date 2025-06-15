import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../users/entity/user.entity';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginThrottlingGuard } from './guards/login-throttling.guard';

interface RequestWithUser extends Request {
  user: User;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Cette méthode ne sera pas exécutée,
    // car le garde d'authentification redirigera vers Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: RequestWithUser) {
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

  @Get('apple')
  @UseGuards(AuthGuard('apple'))
  async appleAuth() {
    // Cette méthode ne sera pas exécutée,
    // car le garde d'authentification redirigera vers Apple
  }

  @Get('apple/callback')
  @UseGuards(AuthGuard('apple'))
  appleAuthRedirect(@Req() req: RequestWithUser) {
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

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  getProfile(@Req() req: RequestWithUser) {
    return req.user;
  }

  @Post('register')
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
  login(@Req() req: RequestWithUser) {
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
}
