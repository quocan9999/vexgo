import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupportWidget } from '@/components/layout/support-widget';
import { aiChatbotService } from '@/features/ai-chatbot/services/ai-chatbot.service';

vi.mock('@/features/support-chat/components/customer-support-chat', () => ({
  CustomerSupportChat: () => <div data-testid="mock-customer-support-chat">Mock CSKH</div>,
}));

vi.mock('@/features/ai-chatbot/services/ai-chatbot.service', () => ({
  aiChatbotService: {
    getSuggestions: vi.fn(async () => []),
    sendMessage: vi.fn(),
  },
}));

describe('SupportWidget Customer Web Clean Output (Phase 03)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('renders 100% clean output without citations block or debug toggle on Customer Web', async () => {
    vi.mocked(aiChatbotService.sendMessage).mockResolvedValueOnce({
      reply: 'Chính sách hoàn vé của VexGo cho phép hủy trước 24h miễn phí.',
      sessionToken: 'test-session',
      intent: 'POLICY_QUERY',
      requiresHumanHandoff: false,
      latencyMs: 120,
      citations: [
        {
          documentCode: 'DOC-POLICY-01',
          title: 'Quy chế hủy vé VexGo',
          hierarchyPath: '[Quy chế] > [Chương I: Hủy vé]',
          relevanceScore: 92,
        },
      ],
    });

    render(<SupportWidget />);

    // 1. Mở cửa sổ AI Bot
    const botBtn = screen.getByTestId('ai-bot-floating-button');
    fireEvent.click(botBtn);

    expect(screen.getByTestId('ai-bot-window')).toBeTruthy();

    // 2. Không có nút toggle debug trên header của Customer Web (chỉ dành cho Admin)
    expect(screen.queryByTestId('ai-citation-toggle-button')).toBeNull();

    // 3. Gửi tin nhắn hỏi chính sách
    const input = screen.getByPlaceholderText('Nhập câu hỏi hoặc yêu cầu hỗ trợ...');
    fireEvent.change(input, { target: { value: 'Chính sách hoàn vé thế nào?' } });

    const sendBtn = screen.getByRole('button', { name: 'Gửi tin nhắn' });
    await act(async () => {
      fireEvent.click(sendBtn);
    });

    // 4. Nội dung câu trả lời hiển thị sạch sẽ
    expect(
      screen.getByText('Chính sách hoàn vé của VexGo cho phép hủy trước 24h miễn phí.'),
    ).toBeTruthy();

    // 5. Khối trích dẫn nguồn HOÀN TOÀN KHÔNG XUẤT HIỆN trên Customer Web
    expect(screen.queryByTestId('ai-citations-debug-container')).toBeNull();
    expect(screen.queryByText(/Nguồn trích dẫn/i)).toBeNull();
  });

  it('properly formats bold markdown and cleans leaked document tags from reply', async () => {
    vi.mocked(aiChatbotService.sendMessage).mockResolvedValueOnce({
      reply: 'Quy định chi tiết:\n- **Thời gian hoàn tiền** 【DOC-CANCEL-POLICY】: trong 24-48 giờ làm việc.',
      sessionToken: 'test-session',
      intent: 'POLICY_QUERY',
      requiresHumanHandoff: false,
      latencyMs: 140,
      citations: [
        {
          documentCode: 'DOC-CANCEL-POLICY',
          title: 'Chính sách hủy vé',
          hierarchyPath: '[Quy chế] > [Hủy vé]',
          relevanceScore: 95,
        },
      ],
    });

    render(<SupportWidget />);

    fireEvent.click(screen.getByTestId('ai-bot-floating-button'));

    const input = screen.getByPlaceholderText('Nhập câu hỏi hoặc yêu cầu hỗ trợ...');
    fireEvent.change(input, { target: { value: 'Thời gian hoàn tiền' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    });

    // 1. Đã format **Thời gian hoàn tiền** thành thẻ strong in đậm thực thụ
    const boldEl = screen
      .getAllByText('Thời gian hoàn tiền')
      .find((el) => el.tagName === 'STRONG');
    expect(boldEl).toBeDefined();
    expect(boldEl?.tagName).toBe('STRONG');

    // 2. Không còn dấu vết raw ** hoặc thẻ 【DOC-CANCEL-POLICY】
    expect(screen.queryByText(/【DOC-CANCEL-POLICY】/)).toBeNull();
    expect(screen.queryByText(/\*\*Thời gian hoàn tiền\*\*/)).toBeNull();
  });

  it('renders suggested trips and human handoff while keeping customer view clean', async () => {
    vi.mocked(aiChatbotService.sendMessage).mockResolvedValueOnce({
      reply: 'Dưới đây là chuyến xe phù hợp với lộ trình của bạn:',
      sessionToken: 'test-session',
      intent: 'FIND_TRIP',
      latencyMs: 250,
      citations: [
        {
          documentCode: 'DOC-TRIP-INFO',
          title: 'Quy định đặt chuyến',
          hierarchyPath: '[Vận hành] > [Tìm chuyến]',
          relevanceScore: 88,
        },
      ],
      suggestedTrips: [
        {
          tripId: 999,
          code: 'TRIP-999',
          operator: 'Phương Trang',
          origin: 'Sài Gòn',
          destination: 'Đà Lạt',
          departureTime: '08:00',
          departureDate: '10/11/2026',
          arrivalTime: '14:00',
          price: 300000,
          vehicleType: 'Limousine 34 phòng',
          availableSeats: 5,
          bookingUrl: '/trips/999',
        },
      ],
      requiresHumanHandoff: true,
      handoffReason: 'Khách hàng yêu cầu hỗ trợ đặc biệt',
    });

    render(<SupportWidget />);

    fireEvent.click(screen.getByTestId('ai-bot-floating-button'));

    const input = screen.getByPlaceholderText('Nhập câu hỏi hoặc yêu cầu hỗ trợ...');
    fireEvent.change(input, { target: { value: 'Tìm xe đi Đà Lạt' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    });

    // Không có trích dẫn
    expect(screen.queryByTestId('ai-citations-debug-container')).toBeNull();

    // Vẫn hiển thị chuyến xe gợi ý
    expect(screen.getByText('Phương Trang')).toBeTruthy();
    expect(screen.getByText('Còn 5 ghế')).toBeTruthy();
    expect(screen.getByText(/300.000\s*đ/)).toBeTruthy();

    // Vẫn hiển thị nút gặp CSKH
    expect(screen.getByText('Gặp CSKH')).toBeTruthy();
  });

  it('converts markdown tables to clean bullet text without pipe characters or raw uuid', async () => {
    vi.mocked(aiChatbotService.sendMessage).mockResolvedValueOnce({
      reply: `Dưới đây là các chuyến xe hiện có:
| Mã chuyến | Nhà xe | Giờ khởi hành | Loại xe | Giá (VNĐ) | Ghế còn | Link đặt vé |
|-----------|--------|---------------|--------|-----------|---------|------------|
| a7d1daf5f2474223a1bf1baf4e87a508 | Thành Bưởi | 06:00 | GIƯỜNG NẰM | 270 000 | 22 | /trips/9202 |
| 1f3938b1c6834851ad8960eead857aad | Phương Trang | 06:00 | GHẾ NGỒI | 180 000 | 28 | /trips/9184 |
Chúc bạn có chuyến đi suôn sẻ!`,
      sessionToken: 'test-session',
      intent: 'TRIP_SEARCH',
      requiresHumanHandoff: false,
      latencyMs: 150,
      citations: [],
    });

    render(<SupportWidget />);

    fireEvent.click(screen.getByTestId('ai-bot-floating-button'));

    const input = screen.getByPlaceholderText('Nhập câu hỏi hoặc yêu cầu hỗ trợ...');
    fireEvent.change(input, { target: { value: 'Tìm xe ngày 15/11' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
    });

    // 1. Không còn dấu hiệu bảng markdown raw (|---|) hay mã UUID
    expect(screen.queryByText(/\|-----------/)).toBeNull();
    expect(screen.queryByText(/a7d1daf5f2474223a1bf1baf4e87a508/)).toBeNull();

    // 2. Chuyển thành text/bullet có tên nhà xe in đậm
    const thanhBuoi = screen.getAllByText('Thành Bưởi').find((el) => el.tagName === 'STRONG');
    expect(thanhBuoi).toBeDefined();
    expect(screen.getAllByText(/Giờ khởi hành: 06:00/).length).toBe(2);
    expect(screen.getByText(/Giá \(VNĐ\): 270 000/)).toBeTruthy();
  });
});
