import { type DynamicModule, Global, Module } from '@nestjs/common';
import { I18N_OPTIONS, type I18nModuleOptions } from './i18n.options';
import { I18nService } from './i18n.service';

/**
 * Server-side translation.
 *
 * Global because rendering is a cross-cutting concern: the inbox renders
 * notifications, the email package renders subjects, and a future digest job
 * renders both — none of them should have to thread an import chain to reach
 * the same bundles.
 */
@Global()
@Module({})
export class I18nModule {
  static forRoot(options: I18nModuleOptions): DynamicModule {
    return {
      module: I18nModule,
      providers: [{ provide: I18N_OPTIONS, useValue: options }, I18nService],
      exports: [I18nService],
    };
  }
}
