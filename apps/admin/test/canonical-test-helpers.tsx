import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, expect, vi } from 'vitest';

beforeEach(() => {
  vi.spyOn(toast, 'success').mockClear();
  vi.spyOn(toast, 'error').mockClear();
  vi.spyOn(toast, 'warning').mockClear();
});

export async function expectOperationToast(kind: 'success' | 'error' | 'warning', message: string | RegExp) {
  await waitFor(() => expect(toast[kind]).toHaveBeenCalledWith(
    typeof message === 'string' ? expect.stringContaining(message) : expect.stringMatching(message),
  ));
}

export async function selectCanonicalOption(trigger: HTMLElement, name: string | RegExp) {
  await waitFor(() => {
    if (trigger.hasAttribute('disabled') || trigger.getAttribute('aria-disabled') === 'true')
      throw new Error('Select options are still loading');
  });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option, { button: 0, pointerType: 'mouse' });
  fireEvent.pointerUp(option, { button: 0, pointerType: 'mouse' });
  fireEvent.click(option);
}

export async function inspectCanonicalOption(trigger: HTMLElement, name: string | RegExp) {
  await waitFor(() => {
    if (trigger.hasAttribute('disabled')) throw new Error('Select is still loading');
  });
  fireEvent.click(trigger);
  const option = await screen.findByRole('option', { name });
  fireEvent.keyDown(option, { key: 'Escape' });
  return option;
}

// Modal contents are portalled and intentionally absent from server markup.
// Each markup snapshot gets a fresh DOM so prior variants cannot satisfy it.
export function renderPortalMarkup(element: ReactElement) {
  cleanup();
  render(element);
  return document.body.innerHTML;
}
