// @vitest-environment jsdom
import React, { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RootLayout from '../src/app/layout';

const fontConfig = vi.hoisted(() => ({
  inter: undefined as { subsets?: string[] } | undefined,
}));

vi.mock('next/font/google', () => ({
  Inter: (options: { subsets?: string[] }) => {
    fontConfig.inter = options;
    return { variable: 'inter-test-variable' };
  },
  JetBrains_Mono: () => ({ variable: 'mono-test-variable' }),
}));

describe('Admin root layout hydration', () => {
  let root: Root | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    root = undefined;
    vi.restoreAllMocks();
  });

  it('loads the Vietnamese subset for the Admin Inter font', () => {
    expect(fontConfig.inter?.subsets).toContain('vietnamese');
  });

  it('tolerates an extension class on html before hydration', async () => {
    const layout = <RootLayout params={Promise.resolve({})}><main>Admin</main></RootLayout>;
    document.open();
    document.write(`<!DOCTYPE html>${renderToString(layout)}`);
    document.close();
    document.documentElement.classList.add('mdl-js');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => { root = hydrateRoot(document, layout); });

    expect(errors.mock.calls.flat().join(' ')).not.toMatch(/hydration|hydrated|didn't match/i);
    expect(document.documentElement.classList.contains('inter-test-variable')).toBe(true);
    expect(document.documentElement.classList.contains('mono-test-variable')).toBe(true);
    expect(document.querySelector('main')?.textContent).toBe('Admin');
  });

  it('still reports mismatched attributes inside the page', async () => {
    const layout = <RootLayout params={Promise.resolve({})}><main data-state="client">Admin</main></RootLayout>;
    document.open();
    document.write(`<!DOCTYPE html>${renderToString(layout)}`);
    document.close();
    document.querySelector('main')?.setAttribute('data-state', 'server');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => { root = hydrateRoot(document, layout); });

    expect(errors.mock.calls.flat().join(' ')).toMatch(/hydration|hydrated|didn't match/i);
  });
});
