import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactsService } from '../../../src/contacts/contacts.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const mockContactRecord = {
  lienHeId: 1,
  hoTen: 'Nguyễn Văn A',
  soDienThoai: '0912345678',
  email: 'a@example.com',
  tieuDe: 'Hỗ trợ hủy vé',
  noiDung: 'Tôi muốn được hỗ trợ hủy vé cho chuyến ngày mai.',
  trangThai: 'CHO_XU_LY',
  createdAt: new Date('2026-10-02T08:00:00.000Z'),
  updatedAt: new Date('2026-10-02T08:00:00.000Z'),
};

const prisma = {
  lienHe: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

const service = new ContactsService(prisma as unknown as PrismaService);

describe('ContactsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a new contact request and maps to response contract', async () => {
      prisma.lienHe.create.mockResolvedValue(mockContactRecord);

      const result = await service.create({
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        email: 'a@example.com',
        subject: 'Hỗ trợ hủy vé',
        message: 'Tôi muốn được hỗ trợ hủy vé cho chuyến ngày mai.',
      });

      expect(prisma.lienHe.create).toHaveBeenCalledWith({
        data: {
          hoTen: 'Nguyễn Văn A',
          soDienThoai: '0912345678',
          email: 'a@example.com',
          tieuDe: 'Hỗ trợ hủy vé',
          noiDung: 'Tôi muốn được hỗ trợ hủy vé cho chuyến ngày mai.',
          trangThai: 'CHO_XU_LY',
        },
      });

      expect(result).toEqual({
        contactId: 1,
        fullName: 'Nguyễn Văn A',
        phoneNumber: '0912345678',
        email: 'a@example.com',
        subject: 'Hỗ trợ hủy vé',
        message: 'Tôi muốn được hỗ trợ hủy vé cho chuyến ngày mai.',
        status: 'CHO_XU_LY',
        createdAt: '2026-10-02T08:00:00.000Z',
        updatedAt: '2026-10-02T08:00:00.000Z',
      });
    });
  });

  describe('findOne', () => {
    it('returns contact when found', async () => {
      prisma.lienHe.findUnique.mockResolvedValue(mockContactRecord);

      const result = await service.findOne(1);
      expect(result.contactId).toBe(1);
      expect(result.fullName).toBe('Nguyễn Văn A');
    });

    it('throws NotFoundException when contact does not exist', async () => {
      prisma.lienHe.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('updates contact status', async () => {
      prisma.lienHe.findUnique.mockResolvedValue(mockContactRecord);
      prisma.lienHe.update.mockResolvedValue({
        ...mockContactRecord,
        trangThai: 'DA_XU_LY',
      });

      const result = await service.updateStatus(1, 'DA_XU_LY');
      expect(result.status).toBe('DA_XU_LY');
      expect(prisma.lienHe.update).toHaveBeenCalledWith({
        where: { lienHeId: 1 },
        data: { trangThai: 'DA_XU_LY' },
      });
    });
  });
});
