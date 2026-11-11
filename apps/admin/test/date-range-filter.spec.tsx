// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DateRangeFilter } from '@/components/data-filters/data-filters';

afterEach(() => {
  cleanup();
});

describe('DateRangeFilter component', () => {
  it('renders default emptyValueLabel when value is null or empty', () => {
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        value={null}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành: Tất cả ngày/i });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Tất cả ngày');
  });

  it('renders single date when from === to (collapsed single date display)', () => {
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        value={{ from: '2026-11-01', to: '2026-11-01' }}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành: 01-11-2026/i });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('01-11-2026');
    expect(trigger.textContent).not.toContain('01-11-2026 – 01-11-2026');
  });

  it('renders full range when from !== to', () => {
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        value={{ from: '2026-11-01', to: '2026-11-30' }}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành: 01-11-2026 – 30-11-2026/i });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('01-11-2026 – 30-11-2026');
  });

  it('renders "Từ ngày: ..." when only from is provided', () => {
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        fromLabel="Từ ngày"
        value={{ from: '2026-11-01' }}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành: Từ ngày: 01-11-2026/i });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Từ ngày: 01-11-2026');
  });

  it('renders "Đến ngày: ..." when only to is provided', () => {
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        toLabel="Đến ngày"
        value={{ to: '2026-11-30' }}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành: Đến ngày: 30-11-2026/i });
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Đến ngày: 30-11-2026');
  });

  it('enables "Áp dụng" and applies half-interval when only from date is entered', () => {
    const handleApply = vi.fn();
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        fromLabel="Từ ngày"
        toLabel="Đến ngày"
        value={null}
        onApply={handleApply}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành/i });
    fireEvent.click(trigger);

    const fromInput = screen.getByLabelText('Từ ngày') as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: '2026-11-05' } });

    const applyButton = screen.getByRole('button', { name: 'Áp dụng' });
    expect(applyButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(applyButton);
    expect(handleApply).toHaveBeenCalledWith({
      from: '2026-11-05',
      to: undefined,
    });
  });

  it('enables "Áp dụng" and applies half-interval when only to date is entered', () => {
    const handleApply = vi.fn();
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        fromLabel="Từ ngày"
        toLabel="Đến ngày"
        value={null}
        onApply={handleApply}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành/i });
    fireEvent.click(trigger);

    const toInput = screen.getByLabelText('Đến ngày') as HTMLInputElement;
    fireEvent.change(toInput, { target: { value: '2026-11-25' } });

    const applyButton = screen.getByRole('button', { name: 'Áp dụng' });
    expect(applyButton.hasAttribute('disabled')).toBe(false);

    fireEvent.click(applyButton);
    expect(handleApply).toHaveBeenCalledWith({
      from: undefined,
      to: '2026-11-25',
    });
  });

  it('disables "Áp dụng" when both dates are empty or when from > to', () => {
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        fromLabel="Từ ngày"
        toLabel="Đến ngày"
        value={null}
        onApply={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành/i });
    fireEvent.click(trigger);

    const applyButton = screen.getByRole('button', { name: 'Áp dụng' });
    expect(applyButton.hasAttribute('disabled')).toBe(true);

    const fromInput = screen.getByLabelText('Từ ngày') as HTMLInputElement;
    const toInput = screen.getByLabelText('Đến ngày') as HTMLInputElement;

    // from > to
    fireEvent.change(fromInput, { target: { value: '2026-11-25' } });
    fireEvent.change(toInput, { target: { value: '2026-11-05' } });
    expect(applyButton.hasAttribute('disabled')).toBe(true);

    // from <= to
    fireEvent.change(toInput, { target: { value: '2026-11-25' } });
    expect(applyButton.hasAttribute('disabled')).toBe(false);
  });

  it('calls onApply(null) when clicking "Xóa lọc"', () => {
    const handleApply = vi.fn();
    render(
      <DateRangeFilter
        label="Ngày khởi hành"
        value={{ from: '2026-11-01', to: '2026-11-10' }}
        onApply={handleApply}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Ngày khởi hành/i });
    fireEvent.click(trigger);

    const clearButton = screen.getByRole('button', { name: 'Xóa lọc' });
    fireEvent.click(clearButton);

    expect(handleApply).toHaveBeenCalledWith(null);
  });
});
