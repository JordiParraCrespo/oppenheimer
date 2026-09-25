import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OppenheimerApp } from '../../di/oppenheimer-app';
import { ANALYTICS_EVENTS, type AnalyticsEvent } from '../../modules/analytics/analytics.events';
import { useCaptureEvent, useCaptureOnMount, usePageView } from '../analytics.queries';
import { OppenheimerProvider } from '../context';

function setup() {
  const capture = vi.fn();
  const pageView = vi.fn();

  const app = { analytics: { capture, pageView } } as unknown as OppenheimerApp;

  // Retries would turn a deliberate failure into a multi-second test, and
  // caching across tests would leak one case's state into the next.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }

  return { wrapper, capture, pageView };
}

describe('useCaptureEvent', () => {
  it('captures through the service', async () => {
    const { wrapper, capture } = setup();
    const { result } = renderHook(() => useCaptureEvent(), { wrapper });

    act(() => {
      result.current.mutate({
        event: ANALYTICS_EVENTS.USER_SIGNED_IN,
        properties: { method: 'password' },
      });
    });

    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_IN, {
        method: 'password',
      }),
    );
  });

  // `mutate` must stay referentially stable, or it can't be passed to a
  // memoized child or listed in a dependency array.
  it('keeps a stable mutate identity across re-renders', () => {
    const { wrapper } = setup();
    const { result, rerender } = renderHook(() => useCaptureEvent(), {
      wrapper,
    });

    const first = result.current.mutate;
    rerender();

    expect(result.current.mutate).toBe(first);
  });

  // The service swallows provider failures, so the mutation should never land
  // in an error state — analytics must not surface as a broken UI.
  it('settles successfully even though the provider is fire-and-forget', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useCaptureEvent(), { wrapper });

    act(() => {
      result.current.mutate({ event: ANALYTICS_EVENTS.USER_SIGNED_OUT });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.error).toBeNull();
  });
});

describe('useCaptureOnMount', () => {
  it('captures once on mount', async () => {
    const { wrapper, capture } = setup();
    renderHook(() => useCaptureOnMount(ANALYTICS_EVENTS.USER_SIGNED_UP), {
      wrapper,
    });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_UP, undefined);
  });

  // A fresh object literal every render is the normal call shape. If that
  // re-fired the capture, a component that renders ten times would report ten
  // impressions of the same thing.
  it('does not re-capture when properties get a new object identity', async () => {
    const { wrapper, capture } = setup();
    const { rerender } = renderHook(
      () => useCaptureOnMount(ANALYTICS_EVENTS.USER_SIGNED_UP, { source: 'login' }),
      { wrapper },
    );

    rerender();
    rerender();

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1));
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('sends the latest properties, not the ones from first render', async () => {
    const { wrapper, capture } = setup();
    renderHook(({ source }) => useCaptureOnMount(ANALYTICS_EVENTS.USER_SIGNED_UP, { source }), {
      wrapper,
      initialProps: { source: 'login' },
    });

    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.USER_SIGNED_UP, {
        source: 'login',
      }),
    );
  });

  // A component reused across events — the same banner rendering a different
  // event key — should report the new one.
  it('captures again when the event name changes', async () => {
    const { wrapper, capture } = setup();
    const { rerender } = renderHook(
      ({ event }: { event: AnalyticsEvent }) => useCaptureOnMount(event),
      {
        wrapper,
        initialProps: {
          event: ANALYTICS_EVENTS.USER_SIGNED_UP as AnalyticsEvent,
        },
      },
    );

    rerender({ event: ANALYTICS_EVENTS.USER_SIGNED_IN });

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
    expect(capture).toHaveBeenLastCalledWith(ANALYTICS_EVENTS.USER_SIGNED_IN, undefined);
  });

  it('captures once per mounted component, not once per tree', async () => {
    const { wrapper: Wrapper, capture } = setup();

    function Banner() {
      useCaptureOnMount(ANALYTICS_EVENTS.USER_SIGNED_UP);
      return null;
    }

    render(
      <Wrapper>
        <Banner />
        <Banner />
      </Wrapper>,
    );

    await waitFor(() => expect(capture).toHaveBeenCalledTimes(2));
  });
});

describe('usePageView', () => {
  it('records a view on mount and on every path change', async () => {
    const { wrapper, pageView } = setup();
    const { rerender } = renderHook(({ path }) => usePageView(path), {
      wrapper,
      initialProps: { path: '/dashboard' },
    });

    await waitFor(() => expect(pageView).toHaveBeenCalledWith('/dashboard', undefined));

    rerender({ path: '/settings' });

    await waitFor(() => expect(pageView).toHaveBeenCalledWith('/settings', undefined));
    expect(pageView).toHaveBeenCalledTimes(2);
  });

  it('does not re-record when the path is unchanged', async () => {
    const { wrapper, pageView } = setup();
    const { rerender } = renderHook(({ path }) => usePageView(path), {
      wrapper,
      initialProps: { path: '/dashboard' },
    });

    await waitFor(() => expect(pageView).toHaveBeenCalledTimes(1));

    rerender({ path: '/dashboard' });
    rerender({ path: '/dashboard' });

    expect(pageView).toHaveBeenCalledTimes(1);
  });
});
