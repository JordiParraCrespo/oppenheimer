# @oppenheimer/backend-i18n

Server-side translation and locale-aware formatting.

The browser has i18next; the server needs a fraction of it, and needs it in
places where there is no request to read a header from — a queued email, a
scheduled digest. This package is that fraction: dotted-key lookup with
interpolation and plurals, plus `Intl` wrappers for money, dates and relative
times.

It **owns no copy**. Bundles are supplied by the application, which passes the
same JSON it already ships to the web app, so a string is written
once and a translator edits one file.

## Usage

```ts
// apps/api/src/app.module.ts
import { en, es } from "@oppenheimer/translations";

I18nModule.forRoot({
  bundles: { en, es },
  defaultLocale: "en",
  defaultTimeZone: "UTC",
});
```

```ts
@Injectable()
class Renderer {
  constructor(private readonly i18n: I18nService) {}

  render(item: InboxItem, locale: string, timeZone: string) {
    const t = this.i18n.for(locale, timeZone);
    return {
      title: t.t("inbox.types.lead.created.title", {
        domain: item.payload.domain,
      }),
      value: t.format(item.payload.value, "currency", { currency: "EUR" }),
      when: t.relativeShort(item.createdAt),
      group: t.dayBucket(item.createdAt),
    };
  }
}
```

## Design notes

**`t()` never throws.** A missing key renders its own path. That is ugly in a
way that gets noticed and fixed; an exception would take down a whole inbox
page over one untranslated notification.

**Locale negotiation is a chain, not a header read.**
`negotiate('?locale=', acceptLanguage, user.locale, org.defaultLocale)` returns
the first candidate that has a bundle, matching `es-ES` onto an `es` bundle.

**Timezone is bound alongside locale.** `i18n.for(locale, timeZone)` returns a
formatter that cannot mix two readers' settings, and day-bucketing
(`today` / `yesterday` / `earlier`) is computed in the reader's zone rather
than the server's — a notification created at 23:30 in Madrid is "today" to a
Madrid reader and "yesterday" to a UTC one.

**Compact relative stamps are copy, not code.** `relativeShort()` resolves
`common.relative.minute` with a count, so English can say `12m` while Spanish
says `12min` without a code change.

**Money is minor units.** `currency(locale, 3_140_000, 'EUR')` → `€31,400.00`
or `31.400,00 €`. No float ever holds a price.
