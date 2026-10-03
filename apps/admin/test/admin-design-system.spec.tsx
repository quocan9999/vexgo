import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const adminSourceDirectory = fileURLToPath(new URL('../src', import.meta.url));
const tokenFile = fileURLToPath(
  new URL('../src/styles/admin-tokens.css', import.meta.url),
);

function collectCssFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectCssFiles(entryPath);
    }

    return entry.name.endsWith('.css') ? [entryPath] : [];
  });
}

function rootTokens(): Map<string, string> {
  const stylesheet = postcss.parse(readFileSync(tokenFile, 'utf8'));
  const tokens = new Map<string, string>();

  stylesheet.nodes?.filter((node) => node.type === 'rule' && node.selector === ':root').forEach((node) => {
    const rule = node as postcss.Rule;
    rule.walkDecls(/^--admin-/, (declaration) => {
      tokens.set(declaration.prop, declaration.value);
    });
  });

  return tokens;
}

describe('Admin design system tokens', () => {
  it('defines a 4px spacing scale and semantic aliases', () => {
    const tokens = rootTokens();

    for (let step = 1; step <= 16; step += 1) {
      const expected = `${Number((step / 4).toFixed(2))}rem`;
      expect(tokens.get(`--admin-space-${step}`)).toBe(expected);
    }

    expect(tokens.get('--admin-space-page-inline')).toBe('var(--admin-space-8)');
    expect(tokens.get('--admin-space-page-block')).toBe('var(--admin-space-8)');
    expect(tokens.get('--admin-space-section-gap')).toBe('var(--admin-space-6)');
    expect(tokens.get('--admin-space-component-gap')).toBe('var(--admin-space-4)');
    expect(tokens.get('--admin-space-field-gap')).toBe('var(--admin-space-3)');
    expect(tokens.get('--admin-space-control-gap')).toBe('var(--admin-space-2)');
    expect(tokens.get('--admin-space-card-padding')).toBe('var(--admin-space-5)');
    expect(tokens.get('--admin-space-state-padding')).toBe('var(--admin-space-8) var(--admin-space-5)');
    expect(tokens.get('--admin-space-notice-padding')).toBe('var(--admin-space-3) var(--admin-space-4)');
    expect(tokens.get('--admin-space-control-padding')).toBe('var(--admin-space-2) var(--admin-space-3)');
    expect(tokens.get('--admin-space-dialog-padding')).toBe('var(--admin-space-6)');
    expect(tokens.get('--admin-space-sheet-inline')).toBe('var(--admin-space-6)');
    expect(tokens.get('--admin-space-table-cell-x')).toBe('var(--admin-space-4)');
    expect(tokens.get('--admin-space-table-cell-y')).toBe('var(--admin-space-3)');
  });

  it('defines semantic typography roles with 14px table body text', () => {
    const tokens = rootTokens();

    expect(tokens.get('--admin-type-page-title-size')).toBe('1.75rem');
    expect(tokens.get('--admin-type-section-heading-size')).toBe('1.25rem');
    expect(tokens.get('--admin-type-component-title-size')).toBe('1rem');
    expect(tokens.get('--admin-type-body-size')).toBe('0.875rem');
    expect(tokens.get('--admin-type-secondary-body-size')).toBe('0.8125rem');
    expect(tokens.get('--admin-type-label-size')).toBe('0.8125rem');
    expect(tokens.get('--admin-type-helper-size')).toBe('0.75rem');
    expect(tokens.get('--admin-type-error-size')).toBe('0.75rem');
    expect(tokens.get('--admin-type-table-header-size')).toBe('0.75rem');
    expect(tokens.get('--admin-type-table-body-size')).toBe('0.875rem');
    expect(tokens.get('--admin-type-button-size')).toBe('0.875rem');
    expect(tokens.get('--admin-type-badge-size')).toBe('0.75rem');

    for (const [role, value] of tokens) {
      if (role.startsWith('--admin-type-') && role.endsWith('-line-height')) {
        expect(value, `${role} must use a fixed rem line height`).toMatch(
          /^\d+(?:\.\d+)?rem$/,
        );
      }
    }
  });

  it('does not use unitless numeric line heights in Admin stylesheets', () => {
    for (const file of collectCssFiles(adminSourceDirectory)) {
      const stylesheet = postcss.parse(readFileSync(file, 'utf8'), { from: file });

      stylesheet.walkDecls('line-height', (declaration) => {
        const selector =
          declaration.parent?.type === 'rule'
            ? declaration.parent.selector
            : 'at-rule';

        expect(
          declaration.value,
          `${file}: ${selector}`,
        ).toMatch(/^(?:\d+(?:\.\d+)?rem|var\(--admin-type-[\w-]+-line-height\))$/);
      });
    }
  });

  it('does not reference retired font-size or weight tokens', () => {
    for (const file of collectCssFiles(adminSourceDirectory)) {
      const stylesheet = postcss.parse(readFileSync(file, 'utf8'), { from: file });

      stylesheet.walkDecls((declaration) => {
        expect(declaration.value, file).not.toMatch(
          /--admin-font-(?:size|weight)-/,
        );
      });
    }
  });
});
