import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleEmailService } from './console-email.service';
import { EmailService } from './email.service';
import { NodemailerEmailService } from './nodemailer-email.service';
import { ResendEmailService } from './resend-email.service';

@Global()
@Module({})
export class EmailModule {
  static register(): DynamicModule {
    return {
      module: EmailModule,
      providers: [
        {
          provide: EmailService,
          useFactory: (configService: ConfigService) => {
            const provider = configService.get('email.provider') || 'console';
            switch (provider) {
              case 'nodemailer':
                return new NodemailerEmailService(configService);
              case 'resend':
                return new ResendEmailService(configService);
              default:
                return new ConsoleEmailService();
            }
          },
          inject: [ConfigService],
        },
      ],
      exports: [EmailService],
    };
  }
}
