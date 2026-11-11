import mammoth from 'mammoth';

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
export const SUPPORTED_DOCUMENT_EXTENSIONS = ['.txt', '.md', '.docx', '.pdf'] as const;

export class DocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentParseError';
  }
}

export interface ParsedDocumentResult {
  content: string;
  defaultTitle: string;
  fileExtension: string;
  characterCount: number;
}

/**
 * Trích xuất nội dung văn bản từ tệp .txt, .md, .docx hoặc .pdf
 * Chuyển đổi Word sang Markdown và chuẩn hóa định dạng văn bản cho RAG
 */
export async function parseKnowledgeDocumentFile(file: File): Promise<ParsedDocumentResult> {
  if (file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new DocumentParseError(
      `Dung lượng tệp (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn 10MB. Vui lòng chọn tệp nhỏ hơn.`,
    );
  }

  const fileName = file.name;
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    throw new DocumentParseError('Tệp không có phần mở rộng hợp lệ. Hệ thống hỗ trợ .txt, .md, .docx, .pdf.');
  }

  const ext = fileName.substring(lastDotIndex).toLowerCase();
  const defaultTitle = fileName.substring(0, lastDotIndex).trim();

  let rawContent = '';

  try {
    if (ext === '.txt' || ext === '.md') {
      rawContent = await file.text();
    } else if (ext === '.docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToMarkdown({ arrayBuffer });
      rawContent = result.value || '';
      // Chuẩn hóa khoảng trắng và dòng trống liên tiếp
      rawContent = rawContent.replace(/\n{3,}/g, '\n\n').trim();
    } else if (ext === '.pdf') {
      const pdfjsLib = await import('pdfjs-dist');
      if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
      }

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });

      const pdf = await loadingTask.promise;
      const pageTexts: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageString = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/Trang\s+\d+(\s*[\/\-]\s*\d+)?/gi, '')
          .replace(/Page\s+\d+(\s*(of|\/)\s*\d+)?/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (pageString) {
          pageTexts.push(pageString);
        }
      }

      rawContent = pageTexts.join('\n\n').trim();
    } else {
      throw new DocumentParseError(
        `Định dạng "${ext}" không được hỗ trợ. Vui lòng chọn tệp .txt, .md, .docx hoặc .pdf.`,
      );
    }
  } catch (error) {
    if (error instanceof DocumentParseError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : 'Không thể đọc tệp.';
    if (message.toLowerCase().includes('password') || message.toLowerCase().includes('encrypted')) {
      throw new DocumentParseError('Tệp đang được đặt mật khẩu hoặc mã hóa bảo vệ. Vui lòng gỡ mật khẩu trước khi tải lên.');
    }
    throw new DocumentParseError(`Lỗi trích xuất tài liệu: ${message}`);
  }

  if (!rawContent || !rawContent.trim()) {
    throw new DocumentParseError('Tệp tải lên không chứa văn bản hoặc nội dung rỗng.');
  }

  return {
    content: rawContent.trim(),
    defaultTitle,
    fileExtension: ext,
    characterCount: rawContent.trim().length,
  };
}
