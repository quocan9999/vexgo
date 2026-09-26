import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import { describe, expect, it, vi } from 'vitest';
import { AdminDetailAction } from '../src/components/admin/admin-detail-action';
import {
  AdminCreateAction,
  AdminRefreshAction,
} from '../src/components/admin/admin-page-actions';
import { AdminResultSummary } from '../src/components/admin/admin-result-summary';
import { AdminTableSkeleton } from '../src/components/admin/admin-table-skeleton';
import { FilterToolbar } from '../src/components/data-filters/data-filters';

describe('shared Admin CRUD patterns', () => {
  it('renders a named Eye detail action with the approved color', () => {
    const markup = renderToStaticMarkup(
      <AdminDetailAction
        onClick={vi.fn()}
        resourceName="nhà xe An Bình"
      />,
    );
    const styles = postcss.parse(
      readFileSync(
        fileURLToPath(new URL('../src/styles/admin-components.css', import.meta.url)),
        'utf8',
      ),
    );
    let color: string | undefined;
    styles.walkRules('.admin-detail-action', (rule) => {
      rule.walkDecls('color', (declaration) => {
        color = declaration.value;
      });
    });

    expect(markup).toContain('aria-label="Xem chi tiết nhà xe An Bình"');
    expect(markup).toContain('Xem chi tiết');
    expect(markup).toMatch(/<svg[^>]*lucide-eye/);
    expect(color?.toLowerCase()).toBe('#3155b6');
  });

  it('renders matching create and refresh actions with a disabled loading state', () => {
    const create = renderToStaticMarkup(
      <AdminCreateAction label="Thêm nhà xe" onClick={vi.fn()} />,
    );
    const refresh = renderToStaticMarkup(
      <AdminRefreshAction loading onClick={vi.fn()} />,
    );

    expect(create).toContain('Thêm nhà xe');
    expect(create).toMatch(/<svg[^>]*lucide-plus/);
    expect(refresh).toContain('Làm mới');
    expect(refresh).toMatch(/<svg[^>]*lucide-refresh-cw/);
    expect(refresh).toContain('disabled=""');
    expect(refresh).toContain('aria-busy="true"');
    expect(refresh).toContain('admin-refresh-spinner');
  });

  it('renders five accessible shimmer rows for initial list loading', () => {
    const markup = renderToStaticMarkup(
      <AdminTableSkeleton resourceLabel="loại xe" />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-label="Đang tải danh sách loại xe"');
    expect(markup.match(/class="admin-table-skeleton-row"/g)).toHaveLength(5);
    expect(markup.match(/class="skeleton /g)).toHaveLength(25);
  });

  it('shows backend totals through the filter toolbar and loading copy before data', () => {
    expect(renderToStaticMarkup(<AdminResultSummary totalItems={0} />)).toBe(
      '0 kết quả',
    );
    const loaded = renderToStaticMarkup(
      <FilterToolbar totalItems={1234}>
        <input aria-label="Tìm kiếm" />
      </FilterToolbar>,
    );
    const loading = renderToStaticMarkup(
      <FilterToolbar totalItems={null}>
        <input aria-label="Tìm kiếm" />
      </FilterToolbar>,
    );

    expect(loaded).toContain('1.234 kết quả');
    expect(loading).toContain('Đang tải kết quả');
    expect(loaded).toContain('aria-live="polite"');
  });

  it('runs Admin tests in CI alongside its existing quality gates', () => {
    const workflow = readFileSync(
      fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url)),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const adminJob = workflow.split('\n  admin:\n')[1]?.split('\n  web:\n')[0];

    expect(adminJob).toContain('npm run test --workspace=@vexgo/admin');
    expect(adminJob).toContain('npm run typecheck --workspace=@vexgo/admin');
    expect(adminJob).toContain('npm run lint --workspace=@vexgo/admin');
    expect(adminJob).toContain('npm run build --workspace=@vexgo/admin');
  });
});
