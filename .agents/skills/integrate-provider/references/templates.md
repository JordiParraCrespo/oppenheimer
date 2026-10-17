# Templates: a new capability behind providers

Skeletons for a new capability, condensed from `apps/api/src/voice/`. Replace
`Sms`/`sms`/`send` with the capability's own noun and verb. The voice module
is the reference when a template and the code disagree: the code is what
CI checks.

## Shared ids and wire types

`packages/shared/src/schemas/sms.schema.ts`

```ts
/** Who can send a message. A new provider adds its id here and nowhere else in this package. */
export const SMS_PROVIDERS = ['twilio', 'messagebird'] as const;
export type SmsProvider = (typeof SMS_PROVIDERS)[number];

/** `GET /sms/status`: the providers that can send for this workspace, in the order a send tries them. */
export interface SmsStatusDto {
  available: boolean;
  providers: SmsProvider[];
}
```

## The port, the registry and the walk

`apps/api/src/sms/application/sms-provider.port.ts`

```ts
export interface SmsGrant<A = unknown> {
  access: A;
}

export interface SmsProviderPort<A = unknown> {
  readonly id: SmsProvider;
  /** Cheap: a row or a config read, never a call to the vendor. */
  availableFor(organizationId: string): Promise<boolean>;
  /** The credential for one call, refreshed if it must be. May throw. */
  grantFor(organizationId: string, now: Date): Promise<SmsGrant<A>>;
  send(message: SmsMessage, grant: SmsGrant<A>): Promise<SmsReceipt>;
}
```

`apps/api/src/sms/application/sms-provider.registry.ts`

```ts
export class SmsProviderRegistry {
  constructor(private readonly providers: readonly SmsProviderPort[]) {
    const ids = providers.map((provider) => provider.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error(`Two SMS providers share an id: ${ids.join(', ')}`);
    }
  }

  async availableFor(organizationId: string): Promise<SmsProviderPort[]> {
    const answers = await Promise.all(
      this.providers.map((provider) => provider.availableFor(organizationId)),
    );
    return this.providers.filter((_, index) => answers[index]);
  }
}
```

`apps/api/src/sms/application/sms.resolver.ts`: the fallback rule, once.

```ts
@Injectable()
export class SmsResolver {
  constructor(private readonly registry: SmsProviderRegistry) {}

  async send(organizationId: string, message: SmsMessage, now: Date) {
    let first: unknown = null;
    for (const provider of await this.registry.availableFor(organizationId)) {
      try {
        const grant = await provider.grantFor(organizationId, now);
        return { receipt: await provider.send(message, grant), provider: provider.id };
      } catch (error) {
        if (error instanceof AppError && error.code === SmsErrors.RATE_LIMITED.code) throw error;
        first ??= error;
      }
    }
    if (first !== null) throw first;
    throw new AppError(SmsErrors.NOT_CONFIGURED);
  }
}
```

## One provider, one gateway

`apps/api/src/sms/application/twilio-sms.resolver.ts`: credential in, gateway out.

```ts
@Injectable()
export class TwilioSmsResolver implements SmsProviderPort<null> {
  readonly id = 'twilio' as const;

  constructor(@Inject(TWILIO_SMS) private readonly gateway: TwilioSmsPort) {}

  async availableFor(): Promise<boolean> {
    return this.gateway.isConfigured();
  }

  async grantFor(): Promise<SmsGrant<null>> {
    return { access: null };
  }

  send(message: SmsMessage): Promise<SmsReceipt> {
    return this.gateway.send(message);
  }
}
```

`apps/api/src/sms/infrastructure/twilio-sms.gateway.ts`: the HTTP, the
budget in the doc comment, every call through one `UpstreamLimiter`, every
answer that is not a receipt mapped to `SmsErrors.PROVIDER_UNAVAILABLE`.
`voice/infrastructure/chatgpt-speech.gateway.ts` is the model.

## The module

```ts
@Module({
  imports: [CqrsModule],
  controllers: [SendSmsHttpController, FindSmsStatusHttpController],
  providers: [
    SendSmsCommandHandler,
    FindSmsStatusQueryHandler,
    SmsResolver,
    TwilioSmsResolver,
    MessagebirdSmsResolver,
    // The providers, in the order a send tries them. A new one is an
    // `SmsProviderPort` class, its id in `SMS_PROVIDERS`, and a place here.
    {
      provide: SmsProviderRegistry,
      inject: [TwilioSmsResolver, MessagebirdSmsResolver],
      useFactory: (twilio: TwilioSmsResolver, messagebird: MessagebirdSmsResolver) =>
        new SmsProviderRegistry([twilio, messagebird]),
    },
    { provide: TWILIO_SMS, useClass: TwilioSmsGateway },
    { provide: MESSAGEBIRD_SMS, useClass: MessagebirdSmsGateway },
  ],
})
export class SmsModule {}
```

## The resolver spec over fake providers

```ts
function provider(id: SmsProvider, available = true) {
  return {
    id,
    availableFor: vi.fn().mockResolvedValue(available),
    grantFor: vi.fn().mockResolvedValue({ access: null }),
    send: vi.fn().mockResolvedValue({ id: `${id}-receipt` }),
  } satisfies SmsProviderPort<null>;
}
```

Then one `it` per line of the fallback rule: first available wins and the
unavailable is never granted; a failure falls through; a rate limit does not
and the next is never granted; the first failure is the answer; none
available is `NOT_CONFIGURED`; two providers with one id are refused.
`voice/__tests__/voice-transcription.resolver.spec.ts` is the model.
