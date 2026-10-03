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
    const scale = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

    for (let index = 0; index < scale.length; index += 1) {
      const expected = `${scale[index]}rem`;
      expect(tokens.get(`--admin-space-${index + 1}`)).toBe(expected);
    }

    expect(tokens.get('--admin-space-page-inline')).toBe('var(--admin-space-7)');
    expect(tokens.get('--admin-space-page-block')).toBe('var(--admin-space-7)');
    expect(tokens.get('--admin-space-section-gap')).toBe('var(--admin-space-6)');
    expect(tokens.get('--admin-space-component-gap')).toBe('var(--admin-space-4)');
    expect(tokens.get('--admin-space-field-gap')).toBe('var(--admin-space-3)');
    expect(tokens.get('--admin-space-control-gap')).toBe('var(--admin-space-2)');
    expect(tokens.get('--admin-space-card-padding')).toBe('var(--admin-space-5)');
    expect(tokens.get('--admin-space-state-padding')).toBe('var(--admin-space-7) var(--admin-space-5)');
    expect(tokens.get('--admin-space-notice-padding')).toBe('var(--admin-space-3) var(--admin-space-4)');
    expect(tokens.get('--admin-space-control-padding')).toBe('var(--admin-space-2) var(--admin-space-3)');
    expect(tokens.get('--admin-space-dialog-padding')).toBe('var(--admin-space-6)');
    expect(tokens.get('--admin-space-sheet-inline')).toBe('var(--admin-space-6)');
    expect(tokens.get('--admin-space-table-cell-x')).toBe('var(--admin-space-4)');
    expect(tokens.get('--admin-space-table-cell-y')).toBe('var(--admin-space-3)');
  });

  it('defines semantic typography roles with 13px table body text', () => {
    const tokens = rootTokens();
    const roleValues: Record<string, { size: string; lineHeight: string; weight: string }> = {
      '--admin-type-display': { size: '2rem', lineHeight: '1.2', weight: 'var(--admin-weight-bold)' },
      '--admin-type-page-title': { size: '1.75rem', lineHeight: '1.2', weight: 'var(--admin-weight-bold)' },
      '--admin-type-section-heading': { size: '1.25rem', lineHeight: '1.3', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-component-title': { size: '1rem', lineHeight: '1.35', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-body': { size: '0.875rem', lineHeight: '1.5', weight: 'var(--admin-weight-regular)' },
      '--admin-type-secondary-body': { size: '0.8125rem', lineHeight: '1.45', weight: 'var(--admin-weight-regular)' },
      '--admin-type-label': { size: '0.8125rem', lineHeight: '1.35', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-helper': { size: '0.75rem', lineHeight: '1.4', weight: 'var(--admin-weight-regular)' },
      '--admin-type-error': { size: '0.75rem', lineHeight: '1.4', weight: 'var(--admin-weight-medium)' },
      '--admin-type-table-header': { size: '0.75rem', lineHeight: '1.35', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-table-body': { size: '0.8125rem', lineHeight: '1.45', weight: 'var(--admin-weight-regular)' },
      '--admin-type-button': { size: '0.875rem', lineHeight: '1.2', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-badge': { size: '0.75rem', lineHeight: '1.35', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-caption': { size: '0.75rem', lineHeight: '1.35', weight: 'var(--admin-weight-medium)' },
      '--admin-type-eyebrow': { size: '0.75rem', lineHeight: '1.35', weight: 'var(--admin-weight-semibold)' },
      '--admin-type-metric': { size: '2rem', lineHeight: '1.2', weight: 'var(--admin-weight-bold)' },
      '--admin-type-metric-compact': { size: '1.5rem', lineHeight: '1.2', weight: 'var(--admin-weight-semibold)' },
    };

    for (const [role, expected] of Object.entries(roleValues)) {
      expect(tokens.get(`${role}-size`)).toBe(expected.size);
      expect(tokens.get(`${role}-line-height`)).toBe(expected.lineHeight);
      expect(tokens.get(`${role}-weight`)).toBe(expected.weight);
    }

    for (const [role, value] of tokens) {
      if (role.startsWith('--admin-type-') && role.endsWith('-line-height')) {
        expect(value, `${role} must use a proposal line-height ratio`).toMatch(
          /^(?:1\.2|1\.3|1\.35|1\.4|1\.45|1\.5)$/,
        );
      }
    }
  });

  it('uses role ratios rather than fixed rem line heights in Admin stylesheets', () => {
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
        ).toMatch(/^(?:1\.2|1\.3|1\.35|1\.4|1\.45|1\.5|var\(--admin-type-[\w-]+-line-height\))$/);
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
