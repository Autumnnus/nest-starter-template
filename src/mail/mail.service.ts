import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  template: string;
  type?: 'transactional' | 'notification';
  context?: Record<string, unknown>;
}

export interface PasswordResetMailOptions {
  to: string;
  token: string;
  expiresAt: Date;
}

export interface EmailChangeVerificationOptions {
  to: string;
  token: string;
  expiresAt: Date;
  currentEmail: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
  }

  send(options: SendMailOptions): Promise<void> {
    const payload = {
      ...options,
      to: Array.isArray(options.to) ? options.to : [options.to],
      sentAt: new Date().toISOString(),
    };

    this.logger.log(
      `Email kuyruğa alındı => konu: "${payload.subject}" alıcılar: ${payload.to.join(', ')}`,
      payload,
    );

    return Promise.resolve();
  }

  async sendPasswordResetEmail(
    options: PasswordResetMailOptions,
  ): Promise<void> {
    const resetUrl = `${this.appUrl}/auth/reset-password?token=${encodeURIComponent(
      options.token,
    )}`;

    await this.send({
      to: options.to,
      subject: 'Şifre sıfırlama talimatları',
      template: 'auth/password-reset',
      type: 'transactional',
      context: {
        resetUrl,
        token: options.token,
        expiresAt: options.expiresAt.toISOString(),
      },
    });
  }

  async sendEmailChangeVerification(
    options: EmailChangeVerificationOptions,
  ): Promise<void> {
    const verifyUrl = `${this.appUrl}/auth/confirm-email?token=${encodeURIComponent(
      options.token,
    )}`;

    await this.send({
      to: options.to,
      subject: 'E-posta adresinizi doğrulayın',
      template: 'auth/email-change',
      type: 'transactional',
      context: {
        verifyUrl,
        token: options.token,
        expiresAt: options.expiresAt.toISOString(),
        currentEmail: options.currentEmail,
      },
    });
  }
}
