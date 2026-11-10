import { describe, expect, it } from 'vitest';
import { TextChunkerService } from '../../../src/ai-chatbot/chunking/text-chunker.service.js';

describe('TextChunkerService', () => {
  const service = new TextChunkerService();

  it('should return a single chunk if text is smaller than chunkSize', () => {
    const text = 'Chính sách hoàn hủy vé xe của VexGo rất linh hoạt và minh bạch.';
    const hierarchyPath = '[VexGo] > [Chính sách] > [Hoàn hủy]';
    const chunks = service.splitText(text, hierarchyPath, {
      chunkSize: 500,
      chunkOverlap: 100,
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].headerPrefix).toBe(hierarchyPath);
    expect(chunks[0].rawContent).toBe(text);
    expect(chunks[0].groundedContent).toBe(`${hierarchyPath}\n\n${text}`);
  });

  it('should split long text into multiple chunks adhering to chunkSize and chunkOverlap', () => {
    // Tạo đoạn văn bản dài hơn 1200 ký tự với các dấu đoạn
    const paragraph1 = 'Quy định hủy vé: Khách hàng được quyền yêu cầu hủy vé trực tuyến trước giờ khởi hành ít nhất 2.5 tiếng. Nếu hủy trước 24 tiếng, phí hủy vé là 10% giá vé niêm yết. Tiền hoàn sẽ được chuyển tự động về tài khoản ngân hàng hoặc ví điện tử mà khách hàng đã dùng để thanh toán trong vòng 24 đến 48 giờ làm việc.';
    const paragraph2 = 'Trường hợp hủy vé trong khoảng từ 2.5 tiếng đến 24 tiếng trước giờ khởi hành, phí hủy áp dụng là 20% giá trị vé. Số tiền còn lại sau khi trừ phí sẽ được hoàn trả đầy đủ cho hành khách theo đúng quy trình tài chính của hệ thống VexGo.';
    const paragraph3 = 'Nếu thời gian đến giờ khởi hành còn dưới 2.5 tiếng, hệ thống trực tuyến sẽ khóa chức năng hủy vé tự động. Hành khách cần liên hệ trực tiếp với đường dây nóng của nhà xe để được nhân viên hỗ trợ xử lý theo trường hợp đặc biệt.';
    const paragraph4 = 'Lưu ý rằng đối với các đơn hàng có dịch vụ gửi hàng hóa hoặc bưu kiện đi kèm chưa hoàn tất việc hủy, hành khách phải tiến hành xử lý hủy vận đơn trước khi hệ thống chấp nhận yêu cầu hủy vé xe để tránh xung đột dữ liệu tài chính.';

    const fullText = [paragraph1, paragraph2, paragraph3, paragraph4].join('\n\n');
    const hierarchyPath = '[Quy chế] > [Chương II: Đổi trả vé]';

    const chunks = service.splitText(fullText, hierarchyPath, {
      chunkSize: 500,
      chunkOverlap: 100,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.rawContent.length).toBeLessThanOrEqual(500);
      expect(chunk.headerPrefix).toBe(hierarchyPath);
      expect(chunk.groundedContent).toBe(`${hierarchyPath}\n\n${chunk.rawContent}`);
    }

    // Kiểm tra tính tuần tự của chunkIndex
    chunks.forEach((chunk, index) => {
      expect(chunk.chunkIndex).toBe(index);
    });
  });

  it('should correctly format grounded content C_i^grounded = H_i ⊕ C_i', () => {
    const text = 'Nội dung quy định vận chuyển hàng hóa đặc biệt.';
    const hierarchyPath = '[VexGo] > [Vận chuyển hàng hóa]';
    const chunks = service.splitText(text, hierarchyPath);

    expect(chunks[0].groundedContent).toBe(`${hierarchyPath}\n\n${text}`);
  });

  it('should handle empty text gracefully', () => {
    const chunks = service.splitText('', '[Header]');
    expect(chunks).toEqual([]);
  });

  it('should handle whitespace-only text gracefully', () => {
    const chunks = service.splitText('   \n\n   ', '[Header]');
    expect(chunks).toEqual([]);
  });
});
