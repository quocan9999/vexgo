import { expectOperationToast } from './canonical-test-helpers';
import { selectCanonicalOption } from './canonical-test-helpers';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PromotionsManagement } from '@/features/promotions/components/promotions-management';
import { PromotionApiError } from '@/features/promotions/services/promotion-service';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

const state = vi.hoisted(() => ({
  promotionPage: null as unknown,
  refresh: vi.fn(),
  createPromotion: vi.fn(),
  updatePromotion: vi.fn(),
  updatePromotionStatus: vi.fn(),
  getPromotionById: vi.fn(),
}));

const activePromotion = {
  id: 15,
  name: 'Mùa hè',
  code: 'SUMMER10',
  discountType: 'PHAN_TRAM' as const,
  discountValue: '10.00',
  maxDiscount: '50000.00',
  minimumTicketAmount: null,
  startsOn: '2026-01-01',
  endsOn: '2027-12-31',
  status: 'HOAT_DONG' as const,
  usageCount: 4,
  usageLimit: 100,
  remainingUses: 96,
  effectiveState: 'ACTIVE' as const,
};

const expiredSuspendedPromotion = {
  ...activePromotion,
  id: 16,
  code: 'OLD2025',
  status: 'TAM_NGUNG' as const,
  startsOn: '2025-01-01',
  endsOn: '2025-12-31',
  effectiveState: 'SUSPENDED' as const,
};
const exhaustedSuspendedPromotion = {
  ...activePromotion,
  id: 17,
  code: 'FULL2027',
  status: 'TAM_NGUNG' as const,
  startsOn: '2020-01-01',
  endsOn: '2099-12-31',
  usageCount: 100,
  remainingUses: 0,
  effectiveState: 'SUSPENDED' as const,
};

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const Icon = () => null;
  return {
    ...actual,
    ArrowDown: Icon,
    ArrowUp: Icon,
    ArrowUpDown: Icon,
    CheckCircle2: Icon,
    ChevronLeft: Icon,
    ChevronRight: Icon,
    Eye: Icon,
    LoaderCircle: Icon,
    Plus: Icon,
    Pencil: Icon,
    RefreshCw: Icon,
    Search: Icon,
    Tag: Icon,
    X: Icon,
  };
});

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/components/data-filters/data-filters', () => ({
  DateRangeFilter: () => null,
  FilterToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SearchInput: ({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) => (
    <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label>
  ),
  SelectFilter: ({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: { value: string; label: string }[]; value: string }) => (
    <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">Tất cả</option>{options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
  ),
}));

vi.mock('@/features/promotions/hooks/use-promotions', () => ({
  usePromotions: () => ({
    promotionPage: state.promotionPage,
    error: null,
    loading: false,
    searchInput: '',
    status: '',
    dateRange: null,
    updateDateRange: vi.fn(),
    sortBy: 'createdAt',
    sortDirection: 'desc',
    changePage: vi.fn(),
    updateSearch: vi.fn(),
    updateStatus: vi.fn(),
    sortPromotions: vi.fn(),
    resetFilters: vi.fn(),
    refresh: state.refresh,
  }),
}));

vi.mock('@/features/promotions/services/promotion-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/promotions/services/promotion-service')>(),
  createPromotion: state.createPromotion,
  updatePromotion: state.updatePromotion,
  getPromotionById: state.getPromotionById,
  updatePromotionStatus: state.updatePromotionStatus,
}));

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value(this: HTMLDialogElement) { this.setAttribute('open', ''); },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    },
  });
});

beforeEach(() => {
  state.promotionPage = {
    data: [activePromotion, expiredSuspendedPromotion, exhaustedSuspendedPromotion],
    meta: { page: 1, pageSize: 10, totalItems: 3, totalPages: 1 },
  };
  state.refresh.mockReset();
  state.createPromotion.mockReset().mockResolvedValue(activePromotion);
  state.updatePromotion.mockReset().mockResolvedValue({ ...activePromotion, name: 'Mùa hè mới', usageLimit: 200 });
  state.updatePromotionStatus.mockReset().mockResolvedValue({ ...activePromotion, status: 'TAM_NGUNG' });
  state.getPromotionById.mockReset().mockResolvedValue(activePromotion);
});

afterEach(() => cleanup());

describe('Admin promotion management permissions and actions', () => {
  it('shows promotion data to a reader without create, edit, or status controls', async () => {
    setEmployeeAdminTestSession(['promotion:read']);
    render(<PromotionsManagement />);

    expect(screen.queryByRole('button', { name: 'Thêm khuyến mãi' })).toBeNull();
    expect(screen.getAllByText('SUMMER10').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Tạm ngưng SUMMER10/ })).toBeNull();

    expect(screen.queryByRole('button', { name: 'Chỉnh sửa SUMMER10' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xem chi tiết SUMMER10' })).toBeNull();
  });

  it('edits all promotion fields in the side drawer and submits the full replacement payload', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:update']);
    render(<PromotionsManagement />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Chỉnh sửa SUMMER10' })[0]);
    const drawer = await screen.findByRole('dialog', { name: 'Chỉnh sửa khuyến mãi' });

    fireEvent.change(within(drawer).getByLabelText('Tên chương trình *'), { target: { value: 'Mùa hè mới' } });
    fireEvent.change(within(drawer).getByLabelText(/Mức giảm/), { target: { value: '12' } });
    fireEvent.change(within(drawer).getByLabelText('Giảm tối đa (VND) *'), { target: { value: '60.000' } });
    fireEvent.change(within(drawer).getByLabelText('Giá trị vé tối thiểu (VND)'), { target: { value: '100.000' } });
    fireEvent.change(within(drawer).getByLabelText('Bắt đầu *'), { target: { value: '2026-02-01' } });
    fireEvent.change(within(drawer).getByLabelText('Kết thúc *'), { target: { value: '2028-12-31' } });
    fireEvent.change(within(drawer).getByLabelText('Số lượt tối đa *'), { target: { value: '200' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(state.updatePromotion).toHaveBeenCalledWith(15, {
      name: 'Mùa hè mới',
      code: 'SUMMER10',
      discountType: 'PHAN_TRAM',
      discountValue: '12',
      maxDiscount: '60000',
      minimumTicketAmount: '100000',
      startsOn: '2026-02-01',
      endsOn: '2028-12-31',
      usageLimit: 200,
    }));
    expect(state.refresh).toHaveBeenCalled();
  });

  it('creates an active promotion with the frozen payload and refreshes the list', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:create']);
    render(<PromotionsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khuyến mãi' }));
    expect(screen.queryByRole('button', { name: 'Tạm ngưng SUMMER10' })).toBeNull();
    const dialog = await screen.findByRole('dialog', { name: 'Thêm khuyến mãi' });

    fireEvent.change(within(dialog).getByLabelText('Tên chương trình *'), { target: { value: 'Tết 2027' } });
    fireEvent.change(within(dialog).getByLabelText('Mã khuyến mãi *'), { target: { value: 'tet2027' } });
    await selectCanonicalOption(within(dialog).getByLabelText('Loại giảm giá *'), "Phần trăm");
    fireEvent.change(within(dialog).getByLabelText(/Mức giảm/), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Giảm tối đa (VND) *'), { target: { value: '50000' } });
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu *'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(dialog).getByLabelText('Kết thúc *'), { target: { value: '2027-01-31' } });
    fireEvent.change(within(dialog).getByLabelText('Số lượt tối đa *'), { target: { value: '200' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo khuyến mãi' }));

    await waitFor(() => expect(state.createPromotion).toHaveBeenCalledWith({
      name: 'Tết 2027',
      code: 'TET2027',
      discountType: 'PHAN_TRAM',
      discountValue: '10',
      maxDiscount: '50000',
      startsOn: '2026-12-01',
      endsOn: '2027-01-31',
      usageLimit: 200,
    }));
    expect(state.refresh).toHaveBeenCalled();
    await expectOperationToast('success', /Đã tạo khuyến mãi/);
  });

  it('supports fixed-amount promotions without a percentage cap field', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:create']);
    render(<PromotionsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khuyến mãi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm khuyến mãi' });

    fireEvent.change(within(dialog).getByLabelText('Tên chương trình *'), { target: { value: 'Vé đầu năm' } });
    fireEvent.change(within(dialog).getByLabelText('Mã khuyến mãi *'), { target: { value: 'DAUNAM' } });
    await selectCanonicalOption(within(dialog).getByLabelText('Loại giảm giá *'), "Số tiền cố định");
    fireEvent.change(within(dialog).getByLabelText(/Mức giảm/), { target: { value: '25000' } });
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu *'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(dialog).getByLabelText('Kết thúc *'), { target: { value: '2027-01-31' } });
    fireEvent.change(within(dialog).getByLabelText('Số lượt tối đa *'), { target: { value: '200' } });
    expect(within(dialog).queryByLabelText('Giảm tối đa (VND) *')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo khuyến mãi' }));

    await waitFor(() => expect(state.createPromotion).toHaveBeenCalledWith({
      name: 'Vé đầu năm', code: 'DAUNAM', discountType: 'SO_TIEN', discountValue: '25000',
      startsOn: '2026-12-01', endsOn: '2027-01-31', usageLimit: 200,
    }));
  });

  it('shows linked inline validation before sending an incomplete form', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:create']);
    render(<PromotionsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khuyến mãi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm khuyến mãi' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo khuyến mãi' }));

    expect(within(dialog).queryByText(/trường cần kiểm tra/i)).toBeNull();
    expect(within(dialog).getByLabelText('Tên chương trình *').getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByLabelText('Mã khuyến mãi *').getAttribute('aria-describedby')).toBe('create-promotion-code-error');
    expect(within(dialog).getByText(/Mã gồm 3–50 ký tự/)).toBeTruthy();
    expect(state.createPromotion).not.toHaveBeenCalled();
  });

  it('requires confirmation before pausing and sends no request when cancelled', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:update']);
    render(<PromotionsManagement />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạm ngưng SUMMER10' })[0]!);
    const confirm = await screen.findByRole('alertdialog', { name: 'Tạm ngưng khuyến mãi?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Hủy' }));
    expect(state.updatePromotionStatus).not.toHaveBeenCalled();
  });

  it('updates status only after confirmation and refreshes the list', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:update']);
    render(<PromotionsManagement />);
    expect(screen.queryByRole('button', { name: 'Thêm khuyến mãi' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạm ngưng SUMMER10' })[0]!);
    const confirm = await screen.findByRole('alertdialog', { name: 'Tạm ngưng khuyến mãi?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Tạm ngưng' }));

    await waitFor(() => expect(state.updatePromotionStatus).toHaveBeenCalledWith(15, 'TAM_NGUNG'));
    expect(state.refresh).toHaveBeenCalled();
  });

  it('refreshes after a status conflict and gives the operator a retryable explanation', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:update']);
    state.updatePromotionStatus.mockRejectedValue(new PromotionApiError(
      'Promotion changed concurrently.', 'PROMOTION_CONCURRENT_MODIFICATION', [], 409,
    ));
    render(<PromotionsManagement />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Tạm ngưng SUMMER10' })[0]!);
    const confirm = await screen.findByRole('alertdialog', { name: 'Tạm ngưng khuyến mãi?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Tạm ngưng' }));

    await expectOperationToast('error', 'Khuyến mãi vừa thay đổi.');
    expect(state.refresh).toHaveBeenCalled();
  });

  it('disables reactivation for a suspended promotion that has expired', () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:update']);
    render(<PromotionsManagement />);
    expect(screen.getAllByRole('button', { name: 'Bật lại OLD2025' })[0]).toHaveProperty('disabled', true);
  });

  it('disables reactivation when the quota is exhausted', () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:update']);
    render(<PromotionsManagement />);
    expect(screen.getAllByRole('button', { name: 'Bật lại FULL2027' })[0]).toHaveProperty('disabled', true);
  });

  it('keeps entered values and maps duplicate-code server errors to the form', async () => {
    setEmployeeAdminTestSession(['promotion:read', 'promotion:create']);
    state.createPromotion.mockRejectedValue(new PromotionApiError('Mã đã tồn tại.', 'PROMOTION_CODE_EXISTS'));
    render(<PromotionsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm khuyến mãi' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm khuyến mãi' });

    fireEvent.change(within(dialog).getByLabelText('Tên chương trình *'), { target: { value: 'Tết 2027' } });
    fireEvent.change(within(dialog).getByLabelText('Mã khuyến mãi *'), { target: { value: 'TET2027' } });
    await selectCanonicalOption(within(dialog).getByLabelText('Loại giảm giá *'), "Phần trăm");
    fireEvent.change(within(dialog).getByLabelText(/Mức giảm/), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Giảm tối đa (VND) *'), { target: { value: '50000' } });
    fireEvent.change(within(dialog).getByLabelText('Bắt đầu *'), { target: { value: '2026-12-01' } });
    fireEvent.change(within(dialog).getByLabelText('Kết thúc *'), { target: { value: '2027-01-31' } });
    fireEvent.change(within(dialog).getByLabelText('Số lượt tối đa *'), { target: { value: '200' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tạo khuyến mãi' }));

    await waitFor(() => expect(state.createPromotion).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByLabelText('Mã khuyến mãi *')).toHaveProperty('value', 'TET2027');
    expect(within(dialog).getAllByText('Mã khuyến mãi đã tồn tại trong nhà xe này.').length).toBeGreaterThan(0);
  });
});
