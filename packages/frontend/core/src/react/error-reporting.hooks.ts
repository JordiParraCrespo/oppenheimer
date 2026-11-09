'use client';
import { useContext, useEffect } from 'react';
import type { ErrorReportContext } from '../modules/error-reporting/error-reporting.client';
import { OppenheimerContext } from './context';

/**
 * The app's `errors.capture`, for a boundary's `onError`. Outside an
 * `OppenheimerProvider` (a kit component in its own spec) it reports nothing:
 * a boundary must draw its failure whether or not anyone hears about it.
 */
export function useCaptureError(): (error: unknown, context?: ErrorReportContext) => void {
  const app = useContext(OppenheimerContext);
  return (error, context) => {
    app?.errors.capture(error, context);
  };
}

/**
 * Reports an error a boundary draws, once per error: the error reporter is
 * the system outside React this synchronises with. What is reported is
 * `ErrorReportingService`'s call; a request failure is not.
 */
export function useReportError(error: unknown, boundary: string): void {
  const app = useContext(OppenheimerContext);

  useEffect(() => {
    app?.errors.capture(error, { tags: { boundary } });
  }, [app, error, boundary]);
}
