import { randomUUID } from 'node:crypto';

/**
 * Sinh mã định danh nghiệp vụ chuẩn UUID v4 bỏ dấu gạch nối (32 ký tự hex viết thường).
 * Ví dụ: "e4b3f81d4fae4d60a16b9b218b056501"
 */
export function generateBusinessUuid(): string {
  return randomUUID().replace(/-/g, '').toLowerCase();
}
