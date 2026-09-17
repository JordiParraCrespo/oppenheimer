import { OppenheimerProvider, usersKeys } from '@oppenheimer/frontend-core/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TOKENS } from '../../di/tokens';
import {
  profileKeys,
  useChangeOwnPassword,
  useDeleteAvatar,
  useMyProfile,
  useProfileSessions,
  useRevokeOtherProfileSessions,
  useRevokeProfileSession,
  useUpdateMyProfile,
  useUploadAvatar,
} from '../profile.queries';
import { fakeKernel } from './fake-kernel';

const SAVED_PROFILE = { id: 'user-1', firstName: 'Adri', lastName: 'Rodrigo' };
function setup() {
  const profile = {
    get: vi.fn().mockResolvedValue({ id: 'user-1' }),
    update: vi.fn().mockResolvedValue(SAVED_PROFILE),
    uploadAvatar: vi.fn().mockResolvedValue(SAVED_PROFILE),
    deleteAvatar: vi.fn().mockResolvedValue(SAVED_PROFILE),
    changePassword: vi.fn().mockResolvedValue(undefined),
    getSessions: vi.fn().mockResolvedValue([]),
    revokeSession: vi.fn().mockResolvedValue(undefined),
    revokeOtherSessions: vi.fn().mockResolvedValue(undefined),
  };

  const app = fakeKernel({ [TOKENS.ProfileService]: profile });

  // Retries would turn a deliberate failure into a multi-second test. Each
  // case builds its own client, so nothing leaks between them without a
  // `gcTime: 0` — which would collect the entries these tests seed before they
  // could be read back.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <OppenheimerProvider app={app}>{children}</OppenheimerProvider>
      </QueryClientProvider>
    );
  }

  return { wrapper, profile, queryClient, invalidate };
}

/** The slice of a vitest spy this file reads — just the recorded arguments. */
interface CallRecorder {
  mock: { calls: unknown[][] };
}

/** Did anything invalidate exactly `key`? */
function invalidated(spy: CallRecorder, key: readonly unknown[]): boolean {
  return spy.mock.calls.some(([filters]) => {
    const queryKey = (filters as { queryKey?: readonly unknown[] })?.queryKey ?? [];
    return JSON.stringify(queryKey) === JSON.stringify(key);
  });
}

describe('profileKeys', () => {
  it('nests every key under the module root, so one call clears them all', () => {
    for (const key of [profileKeys.me(), profileKeys.sessions()]) {
      expect(key[0]).toBe('profile');
    }
  });

  it('keeps the panes in separate cache entries', () => {
    expect(profileKeys.me()).not.toEqual(profileKeys.sessions());
  });

  it('does not collide with the user directory', () => {
    // `usersKeys.me()` is the directory's view of the caller; this is the
    // account they edit. Same person, different documents.
    expect(profileKeys.me()).not.toEqual(usersKeys.me());
  });
});

describe('queries', () => {
  it('reads the profile through the service', async () => {
    const { wrapper, profile } = setup();

    const { result } = renderHook(() => useMyProfile(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profile.get).toHaveBeenCalled();
  });

  it('reads the sessions separately from the profile', async () => {
    const { wrapper, profile } = setup();

    const sessions = renderHook(() => useProfileSessions(), { wrapper });

    await waitFor(() => expect(sessions.result.current.isSuccess).toBe(true));
    expect(profile.getSessions).toHaveBeenCalled();
  });
});

describe('profile writes', () => {
  it('saves the edited fields and seeds the cache with what came back', async () => {
    const { wrapper, profile, queryClient } = setup();
    const { result } = renderHook(() => useUpdateMyProfile(), { wrapper });

    act(() => result.current.mutate({ firstName: 'Adri', jobTitle: null }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profile.update).toHaveBeenCalledWith({
      firstName: 'Adri',
      jobTitle: null,
    });
    // Seeded, not invalidated: the write already answered with the document.
    expect(queryClient.getQueryData(profileKeys.me())).toBe(SAVED_PROFILE);
  });

  it('refreshes the directory too, so the shell renames with the card', async () => {
    // The sidebar reads the caller's name from `usersKeys.me()`. Leaving it
    // alone renames the profile card and nothing else on screen.
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(() => useUpdateMyProfile(), { wrapper });

    act(() => result.current.mutate({ firstName: 'Adri' }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidated(invalidate, usersKeys.me())).toBe(true);
  });

  it('treats an avatar upload and removal as the same kind of write', async () => {
    const { wrapper, profile, queryClient } = setup();
    const upload = renderHook(() => useUploadAvatar(), { wrapper });
    const remove = renderHook(() => useDeleteAvatar(), { wrapper });

    const file = new Blob(['x'], { type: 'image/png' });
    act(() => upload.result.current.mutate(file));
    await waitFor(() => expect(upload.result.current.isSuccess).toBe(true));
    expect(profile.uploadAvatar).toHaveBeenCalledWith(file);
    expect(queryClient.getQueryData(profileKeys.me())).toBe(SAVED_PROFILE);

    act(() => remove.result.current.mutate());
    await waitFor(() => expect(remove.result.current.isSuccess).toBe(true));
    expect(profile.deleteAvatar).toHaveBeenCalled();
  });

  it('still calls a caller-supplied onSuccess', async () => {
    const onSuccess = vi.fn();
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateMyProfile({ onSuccess }), {
      wrapper,
    });

    act(() => result.current.mutate({ firstName: 'Adri' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});

describe('sessions', () => {
  it('refreshes the device list after revoking one', async () => {
    const { wrapper, profile, invalidate } = setup();
    const { result } = renderHook(() => useRevokeProfileSession(), { wrapper });

    act(() => result.current.mutate('session-2'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profile.revokeSession).toHaveBeenCalledWith('session-2');
    expect(invalidated(invalidate, profileKeys.sessions())).toBe(true);
  });

  it('refreshes the device list after revoking all the others', async () => {
    const { wrapper, profile, invalidate } = setup();
    const { result } = renderHook(() => useRevokeOtherProfileSessions(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profile.revokeOtherSessions).toHaveBeenCalled();
    expect(invalidated(invalidate, profileKeys.sessions())).toBe(true);
  });

  it('refreshes them after a password change too', async () => {
    // The endpoint revokes the other sessions by default, so the list on screen
    // is stale the moment the password lands.
    const { wrapper, profile, invalidate } = setup();
    const { result } = renderHook(() => useChangeOwnPassword(), { wrapper });

    const dto = {
      currentPassword: 'old-password',
      newPassword: 'new-password',
      revokeOtherSessions: true,
    };
    act(() => result.current.mutate(dto));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(profile.changePassword).toHaveBeenCalledWith(dto);
    expect(invalidated(invalidate, profileKeys.sessions())).toBe(true);
  });
});
