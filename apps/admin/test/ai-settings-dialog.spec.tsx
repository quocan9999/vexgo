// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSettingsDialog } from '@/features/ai-knowledge/components/ai-settings-dialog';
import * as serviceModule from '@/features/ai-knowledge/services/ai-knowledge-service';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AiSettingsDialog & Settings Service (Super Admin UI)', () => {
  const mockSettings = {
    id: 1,
    idempotencyTtlDays: 7,
    leaseDurationSeconds: 60,
    contextHistoryLimit: 10,
    temperature: 0.15,
    updatedAt: '2026-11-09T00:00:00Z',
  };

  beforeEach(() => {
    vi.spyOn(serviceModule, 'getAiSettings').mockResolvedValue(mockSettings);
    vi.spyOn(serviceModule, 'updateAiSettings').mockResolvedValue(mockSettings);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. should fetch and display current AI settings when dialog opens', async () => {
    render(<AiSettingsDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByText('Cấu hình tham số hệ thống Trợ lý ảo AI')).toBeDefined();

    await waitFor(() => {
      const ttlInput = document.querySelector('#idempotencyTtlDays') as HTMLInputElement;
      expect(ttlInput).not.toBeNull();
      expect(ttlInput.value).toBe('7');
    });

    const leaseInput = document.querySelector('#leaseDurationSeconds') as HTMLInputElement;
    expect(leaseInput.value).toBe('60');

    const contextInput = document.querySelector('#contextHistoryLimit') as HTMLInputElement;
    expect(contextInput.value).toBe('10');

    const tempInput = document.querySelector('#temperature') as HTMLInputElement;
    expect(tempInput.value).toBe('0.15');
  });

  it('2. should open info explainer dialog with realistic example when info icon is clicked', async () => {
    render(<AiSettingsDialog open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Thông tin Idempotency TTL')).toBeDefined();
    });

    // Click the info icon for Idempotency TTL
    const infoButton = screen.getByLabelText('Thông tin Idempotency TTL');
    fireEvent.click(infoButton);

    // Explainer dialog should appear
    await waitFor(() => {
      expect(screen.getByText('Mục đích và ý nghĩa:')).toBeDefined();
      expect(screen.getByText(/Ví dụ thực tế:/i)).toBeDefined();
      expect(screen.getByText(/Đã hiểu/i)).toBeDefined();
    });

    // Click "Đã hiểu" to dismiss info dialog
    fireEvent.click(screen.getByText('Đã hiểu'));
    await waitFor(() => {
      expect(screen.queryByText('Mục đích và ý nghĩa:')).toBeNull();
    });
  });

  it('3. should submit updated values and call updateAiSettings', async () => {
    const onOpenChange = vi.fn();
    render(<AiSettingsDialog open={true} onOpenChange={onOpenChange} />);

    await waitFor(() => {
      const ttlInput = document.querySelector('#idempotencyTtlDays') as HTMLInputElement;
      expect(ttlInput).not.toBeNull();
    });

    const ttlInput = document.querySelector('#idempotencyTtlDays') as HTMLInputElement;
    fireEvent.change(ttlInput, { target: { value: '14' } });

    const submitButton = screen.getByRole('button', { name: /Lưu cấu hình/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(serviceModule.updateAiSettings).toHaveBeenCalledWith({
        idempotencyTtlDays: 14,
        leaseDurationSeconds: 60,
        contextHistoryLimit: 10,
        temperature: 0.15,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
