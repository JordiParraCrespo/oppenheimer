import { type DynamicModule, Global, Module } from '@nestjs/common';
import { I18N_OPTIONS, type I18nModuleOptions } from './i18n.options';
import { I18nService } from './i18n.service';

/**
 * Server-side translation. Global because rendering is cross-cutting: any
 * module that renders copy (the email jobs today) reaches the same bundles
 * without threading an import chain.
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
