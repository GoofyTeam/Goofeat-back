/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';
import { User } from '../../users/entity/user.entity';

interface EmailContext {
  firstName: string;
  email: string;
  frontendUrl: string;
  [key: string]: any;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly redirectEmail: string | null;

  constructor(private readonly mailerService: MailerService) {
    this.redirectEmail = process.env.REDIRECT_EMAIL || null;

    if (this.redirectEmail && process.env.NODE_ENV === 'development') {
      this.logger.warn(
        `⚠️  Mode développement : tous les emails seront redirigés vers ${this.redirectEmail}`,
      );
    }
  }

  private getRecipientEmail(originalEmail: string): string {
    if (process.env.NODE_ENV === 'development' && this.redirectEmail) {
      this.logger.log(
        `Email redirigé : ${originalEmail} → ${this.redirectEmail}`,
      );
      return this.redirectEmail;
    }
    return originalEmail;
  }

  async sendWelcomeEmail(
    user: User,
    frontendUrl: string = process.env.FRONTEND_URL || 'http://localhost:4200',
  ) {
    const context: EmailContext = {
      firstName: user.firstName,
      email: user.email,
      frontendUrl,
      currentYear: new Date().getFullYear(),
    };

    await this.mailerService.sendMail({
      to: this.getRecipientEmail(user.email),
      from: `"${process.env.SMTP_FROM_NAME || 'Goofeat'}" <${process.env.SMTP_FROM || 'noreply@goofeat.com'}>`,
      subject: 'Bienvenue sur Goofeat !',
      template: './welcome',
      context,
    });
  }

  async sendPasswordResetEmail(
    user: User,
    resetToken: string,
    frontendUrl: string = process.env.FRONTEND_URL || 'http://localhost:4200',
  ) {
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const context: EmailContext = {
      firstName: user.firstName,
      email: user.email,
      resetUrl,
      frontendUrl,
      currentYear: new Date().getFullYear(),
    };

    await this.mailerService.sendMail({
      to: this.getRecipientEmail(user.email),
      from: `"${process.env.SMTP_FROM_NAME || 'Goofeat'}" <${process.env.SMTP_FROM || 'noreply@goofeat.com'}>`,
      subject: 'Réinitialisation de votre mot de passe',
      template: './reset-password',
      context,
    });
  }

  async sendPasswordChangeConfirmation(
    user: User,
    ipAddress?: string,
    userAgent?: string,
    frontendUrl: string = process.env.FRONTEND_URL || 'http://localhost:4200',
  ) {
    const context: EmailContext = {
      firstName: user.firstName,
      email: user.email,
      changeDate: new Date().toLocaleString('fr-FR'),
      ipAddress: ipAddress || 'Non disponible',
      userAgent: userAgent || 'Non disponible',
      frontendUrl,
      currentYear: new Date().getFullYear(),
    };

    await this.mailerService.sendMail({
      to: this.getRecipientEmail(user.email),
      from: `"${process.env.SMTP_FROM_NAME || 'Goofeat'}" <${process.env.SMTP_FROM || 'noreply@goofeat.com'}>`,
      subject: 'Votre mot de passe a été modifié',
      template: './change-password-confirmation',
      context,
    });
  }

  async sendEmailVerification(
    user: User,
    verificationToken: string,
    frontendUrl: string = process.env.FRONTEND_URL || 'http://localhost:4200',
  ) {
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const context: EmailContext = {
      firstName: user.firstName,
      email: user.email,
      verificationUrl,
      frontendUrl,
      currentYear: new Date().getFullYear(),
    };

    await this.mailerService.sendMail({
      to: this.getRecipientEmail(user.email),
      from: `"${process.env.SMTP_FROM_NAME || 'Goofeat'}" <${process.env.SMTP_FROM || 'noreply@goofeat.com'}>`,
      subject: 'Vérifiez votre adresse email',
      template: './email-verification',
      context,
    });
  }

  async sendGenericEmail(
    to: string,
    subject: string,
    template: string,
    context: any,
  ) {
    await this.mailerService.sendMail({
      to: this.getRecipientEmail(to),
      from: `"${process.env.SMTP_FROM_NAME || 'Goofeat'}" <${process.env.SMTP_FROM || 'noreply@goofeat.com'}>`,
      subject,
      template: `./${template}`,
      context: {
        ...context,
        currentYear: new Date().getFullYear(),
      },
    });
  }
}
