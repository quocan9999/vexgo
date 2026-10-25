// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ResourceCreateAction,
  ResourceRefreshAction,
  ResourceDetailAction,
  ResourceTableSkeleton,
  ResourcePagination,
} from '@/components/admin/resource-ui';

afterEach(cleanup);

describe('shared Admin CRUD patterns', () => {
  it('renders a named canonical detail action and invokes its callback', () => {
    const onClick = vi.fn();
    render(
      <ResourceDetailAction resourceName="nhà xe An Bình" onClick={onClick} />,
    );
    const button = screen.getByRole('button', {
      name: 'Xem chi tiết nhà xe An Bình',
    });
    expect(button.getAttribute('data-slot')).toBe('button');
    expect(button.textContent).toContain('Xem chi tiết');
    expect(button.querySelector('svg')).not.toBeNull();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('uses canonical create/refresh variants and prevents refresh while loading', () => {
    const create = vi.fn();
    const refresh = vi.fn();
    render(
      <>
        <ResourceCreateAction label="Thêm nhà xe" onClick={create} />
        <ResourceRefreshAction loading onClick={refresh} />
      </>,
    );
    const createButton = screen.getByRole('button', { name: 'Thêm nhà xe' });
    const refreshButton = screen.getByRole('button', { name: 'Làm mới' });
    expect(createButton.classList.contains('bg-primary')).toBe(true);
    expect(refreshButton.classList.contains('border-border')).toBe(true);
    expect(refreshButton).toHaveProperty('disabled', true);
    expect(refreshButton.getAttribute('aria-busy')).toBe('true');
    expect(
      refreshButton
        .querySelector('svg')
        ?.classList.contains('motion-safe:animate-spin'),
    ).toBe(true);
    fireEvent.click(createButton);
    fireEvent.click(refreshButton);
    expect(create).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renders five accessible skeleton rows with twenty-five cells', () => {
    render(<ResourceTableSkeleton resourceLabel="loại xe" />);
    const status = screen.getByRole('status', {
      name: 'Đang tải danh sách loại xe',
    });
    expect(status.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(25);
    const rows = [...status.children].filter((row) =>
      row.hasAttribute('aria-hidden'),
    );
    expect(rows).toHaveLength(5);
    for (const row of rows)
      expect(row.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(5);
  });

  it('announces backend totals and keeps pagination within the available range', () => {
    const onPageChange = vi.fn();
    const props = {
      currentPage: 1,
      onPageChange,
      pageSize: 10,
      summaryLabel: 'xe',
      totalItems: 1234,
      totalPages: 124,
    };
    const { container, rerender } = render(<ResourcePagination {...props} />);
    const summary = container.querySelector('[aria-live="polite"]');
    expect(summary?.textContent).toContain('1–10');
    expect(summary?.textContent).toContain('1.234');
    expect(screen.getByRole('button', { name: 'Trang trước' })).toHaveProperty(
      'disabled',
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    rerender(<ResourcePagination {...props} currentPage={124} />);
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent,
    ).toContain('1231–1234');
    expect(screen.getByRole('button', { name: 'Trang sau' })).toHaveProperty(
      'disabled',
      true,
    );
    rerender(<ResourcePagination {...props} totalItems={0} totalPages={0} />);
    expect(
      container.querySelector('[aria-live="polite"]')?.textContent,
    ).toContain('0–0');
    expect(screen.getByRole('button', { name: 'Trang trước' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Trang sau' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('runs Admin tests in CI alongside its existing quality gates', () => {
    const workflow = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../../.github/workflows/ci.yml'),
      'utf8',
    ).replace(/\r\n/g, '\n');
    const adminJob = workflow.split('\n  admin:\n')[1]?.split('\n  web:\n')[0];

    expect(adminJob).toContain('npm run test --workspace=@vexgo/admin');
    expect(adminJob).toContain('npm run typecheck --workspace=@vexgo/admin');
    expect(adminJob).toContain('npm run lint --workspace=@vexgo/admin');
    expect(adminJob).toContain('npm run build --workspace=@vexgo/admin');
  });
});
