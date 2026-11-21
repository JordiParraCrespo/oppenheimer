import { z } from 'zod';

/** Settings → Model providers in two views: the keys, and what voice runs on. */
export const MODEL_PROVIDER_TABS = ['providers', 'voice'] as const;
export type ModelProviderTab = (typeof MODEL_PROVIDER_TABS)[number];

/** The page's search, so a tab is a link; Providers, the default, is no key. */
export const modelProvidersSearchSchema = z.object({
  tab: z.enum(MODEL_PROVIDER_TABS).optional().catch(undefined),
});
export type ModelProvidersSearch = z.infer<typeof modelProvidersSearchSchema>;
