import type { PermissionGroup, Scope } from '@oppenheimer/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The permission picker's render budget, measured through the form that ships.
 *
 * The catalog has eleven groups and each offers three levels, so the picker is
 * thirty-three toggles. It used to hold one flat `Scope[]` for all of them,
 * which made every click a re-render of the whole thing; each row takes its own
 * field off the form now, so a click costs the three toggles of one row.
 *
 * `CreateApiTokenForm` — the body of the console's "Create API key" dialog, the
 * one screen that mounts the picker — is mounted rather than the picker on a
 * bare `useForm`, because the wrapper is where this gets lost: a `Controller`
 * on `permissions` subscribes to the object the rows write, so it would
 * re-render the picker on every click and the three-toggle budget would be true
 * only of a test double.
 *
 * Runs in the `render-budget` project, which does not enable the React
 * Compiler — deliberately. The compiler brought the old shape down to zero on
 * its own, which is exactly why nobody noticed.
 */

const toggles = { rendered: 0 };

vi.mock('@oppenheimer/design-system-web', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    // Stands in for the real toggle group only to give each option a plain
    // button to click and a place to count from. Everything else — the form,
    // the wrapper, the rows, React Hook Form — is the real thing.
    ToggleGroup: ({
      children,
      onValueChange,
    }: {
      children?: ReactNode;
      onValueChange?: (value: string[]) => void;
    }) => (
      <div>
        {children}
        {['none', 'read', 'write'].map((level) => (
          <button
            key={level}
            type="button"
            data-pick={level}
            onClick={() => onValueChange?.([level])}
          />
        ))}
      </div>
    ),
    ToggleGroupItem: ({ value, children }: { value: string; children?: ReactNode }) => {
      toggles.rendered += 1;
      return (
        <button type="button" data-level={value}>
          {children}
        </button>
      );
    },
  };
});

const RESOURCES = [
  'profile',
  'users',
  'admin',
  'roles',
  'organizations',
  'members',
  'invitations',
  'workspaces',
  'tokens',
  'billing',
  'leads',
] as const;

const GROUPS = RESOURCES.map((resource, index) => ({
  resource,
  label: `Group ${index}`,
  description: 'What this group covers.',
  sensitive: false,
  levels: {
    read: { scope: `${resource}:read`, label: 'Read', description: 'Read it.' },
    write: { scope: `${resource}:write`, label: 'Edit', description: 'Change it.' },
  },
})) as unknown as PermissionGroup[];

const GRANTABLE = GROUPS.flatMap((group) => [
  group.levels.read.scope,
  group.levels.write.scope,
]) as Scope[];

const TOGGLES_PER_ROW = 3;

// Imported after the mock is declared, so the form resolves the stub above.
const { CreateApiTokenForm } = await import('@/features/api-tokens/forms/create-api-token-form');

/**
 * The form reaches the web kit for its debounced search field, and the kit
 * bootstraps i18next — so `t()` here answers with real English copy rather than
 * the key. Asking the same instance keeps the assertions about *which* message
 * appears instead of about what it happens to say today.
 */
const { i18n, i18nReady, SEARCH_DEBOUNCE_MS } = await import('@oppenheimer/frontend-web');
await i18nReady;
const PERMISSIONS_REQUIRED = i18n.t('apiTokens.permissionsRequired');
const FIELD_REQUIRED = i18n.t('validation.required');
const SEARCH_LABEL = i18n.t('settings.api.searchPermissions');

function renderForm(onSubmit = vi.fn()) {
  const { container } = render(
    <CreateApiTokenForm
      groups={GROUPS}
      grantable={GRANTABLE}
      loadingCatalog={false}
      isPending={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  const picks = (level: string) =>
    screen.getAllByRole('button').filter((button) => button.dataset.pick === level);

  // `<form>` has no implicit ARIA role without an accessible name, so it is
  // reached through the container rather than by role.
  const form = container.querySelector('form') as HTMLFormElement;
  const search = screen.getByLabelText(SEARCH_LABEL);

  return { picks, onSubmit, form, search };
}

beforeEach(() => {
  // The search field's debounce is the thing under test in the burst case, so
  // the clock has to be ours rather than a real 300ms wait.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  toggles.rendered = 0;
});

describe('PermissionPicker render budget', () => {
  it('grants one group without redrawing the other ten', () => {
    const { picks } = renderForm();
    // Mounting draws every toggle; `useController` registering each row's field
    // draws them a second time. What matters is what a *click* costs after
    // that.
    expect(toggles.rendered).toBeGreaterThanOrEqual(GROUPS.length * TOGGLES_PER_ROW);

    toggles.rendered = 0;
    fireEvent.click(picks('write')[0]);

    expect(toggles.rendered).toBe(TOGGLES_PER_ROW);
  });

  it('keeps each group on its own field', () => {
    const { picks } = renderForm();

    fireEvent.click(picks('write')[0]);
    fireEvent.click(picks('read')[1]);

    // Each row shows what its own level means, and only its own.
    expect(screen.getAllByText('Change it.')).toHaveLength(1);
    expect(screen.getAllByText('Read it.')).toHaveLength(1);
  });

  it('refuses a token that grants nothing, alongside the other fields', async () => {
    // Both messages in one pass. While the rule sat behind `handleSubmit`'s
    // valid arm it only appeared once every other field already passed, so an
    // empty form reported the missing name and said nothing about permissions.
    const { picks, onSubmit, form } = renderForm();

    fireEvent.submit(form);

    expect(await screen.findByText(PERMISSIONS_REQUIRED)).toBeTruthy();
    expect(screen.getByText(FIELD_REQUIRED)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    // A granted row takes the message away on the click, with nothing cleared.
    fireEvent.click(picks('write')[0]);
    expect(screen.queryByText(PERMISSIONS_REQUIRED)).toBeNull();
  });
});

describe('PermissionSearch render budget', () => {
  it('types without redrawing a single row', () => {
    const { search } = renderForm();
    toggles.rendered = 0;

    for (const value of ['t', 'to', 'tok', 'toke']) {
      fireEvent.change(search, { target: { value } });
    }

    // The half-typed word is the field's. Four characters, no rows — this is
    // the budget the table's search field exists to hold, and the dialog used
    // to break it with live state in the component that mapped the groups.
    expect(toggles.rendered).toBe(0);
  });

  it('redraws only the groups a settled query leaves', () => {
    const { search } = renderForm();

    // `Group 0` matches one of the eleven labels; the rest are filtered out.
    fireEvent.change(search, { target: { value: 'Group 0' } });
    toggles.rendered = 0;
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    // One burst costs one render of what survives the filter, not of the
    // catalog. Filtering has to redraw the rows it keeps; what it must not do
    // is redraw the ones it dropped, or do it per keystroke.
    expect(toggles.rendered).toBe(TOGGLES_PER_ROW);
    expect(screen.getAllByText('What this group covers.')).toHaveLength(1);
  });

  it('keeps a level granted while the query hides its row', () => {
    const { picks, search } = renderForm();

    fireEvent.click(picks('write')[0]);
    fireEvent.change(search, { target: { value: 'Group 7' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    fireEvent.change(search, { target: { value: '' } });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });

    // A filtered-out row unmounts, and React Hook Form keeps its value because
    // `shouldUnregister` is off. If that ever flips, a reader who searches
    // after granting silently loses the grant, and `hasAnyScope` would refuse
    // a form that looks full.
    expect(screen.getAllByText('Change it.')).toHaveLength(1);
  });
});
