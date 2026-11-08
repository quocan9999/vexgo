import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  parseKnowledgeDocumentFile,
  DocumentParseError,
} from '@/features/ai-knowledge/utils/document-parser';

describe('DocumentParser (Client-side Word, PDF, Text, Markdown)', () => {
  it('1. should reject files larger than 10MB', async () => {
    const oversizedFile = new File(['a'], 'oversized-document.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    Object.defineProperty(oversizedFile, 'size', {
      value: MAX_DOCUMENT_FILE_SIZE_BYTES + 1024,
    });

    await expect(parseKnowledgeDocumentFile(oversizedFile)).rejects.toThrow(
      DocumentParseError,
    );
    await expect(parseKnowledgeDocumentFile(oversizedFile)).rejects.toThrow(
      /vượt quá giới hạn 10MB/i,
    );
  });

  it('2. should reject files with unsupported extensions', async () => {
    const unsupportedFile = new File(['content'], 'archive.zip', {
      type: 'application/zip',
    });

    await expect(parseKnowledgeDocumentFile(unsupportedFile)).rejects.toThrow(
      DocumentParseError,
    );
    await expect(parseKnowledgeDocumentFile(unsupportedFile)).rejects.toThrow(
      /không được hỗ trợ/i,
    );
  });

  it('3. should successfully parse .txt and .md files and extract default title', async () => {
    const textContent = '# Quy chế VexGo\n\nNội dung điều khoản bảo lưu vé xe liên tỉnh.';
    const txtFile = new File([textContent], 'chinh-sach-bao-luu.md', {
      type: 'text/markdown',
    });

    const result = await parseKnowledgeDocumentFile(txtFile);

    expect(result.defaultTitle).toBe('chinh-sach-bao-luu');
    expect(result.fileExtension).toBe('.md');
    expect(result.content).toBe(textContent);
    expect(result.characterCount).toBe(textContent.length);
  });

  it('4. should reject empty files with no text content', async () => {
    const emptyFile = new File(['   '], 'empty-policy.txt', {
      type: 'text/plain',
    });

    await expect(parseKnowledgeDocumentFile(emptyFile)).rejects.toThrow(
      /không chứa văn bản hoặc nội dung rỗng/i,
    );
  });
});
