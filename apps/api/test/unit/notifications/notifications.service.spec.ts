import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsService } from '../../../src/notifications/notifications.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

describe('NotificationsService', () => {
  const customer = { khachHangId: 10 };
  const mockNotification = {
    thongBaoNguoiNhanId: 1,
    daDoc: false,
    thoiGianDoc: null,
    thongBaoId: 101,
    khachHangId: 10,
    createdAt: new Date('2026-10-06T07:00:00.000Z'),
    updatedAt: new Date('2026-10-06T07:00:00.000Z'),
    thongBao: {
      thongBaoId: 101,
      tieuDe: 'Đặt vé thành công',
      noiDung: 'Vé chuyến Sài Gòn - Đà Lạt đã được thanh toán.',
      thoiGian: new Date('2026-10-06T07:00:00.000Z'),
      trangThai: 'BOOKING_SUCCESS',
      createdAt: new Date('2026-10-06T07:00:00.000Z'),
      updatedAt: new Date('2026-10-06T07:00:00.000Z'),
    },
  };

  const prisma = {
    khachHang: { findUnique: vi.fn() },
    thongBaoNguoiNhan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  const service = new NotificationsService(prisma as unknown as PrismaService);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.khachHang.findUnique.mockResolvedValue(customer);
  });

  it('throws ForbiddenException if user is not a valid customer', async () => {
    prisma.khachHang.findUnique.mockResolvedValue(null);
    await expect(
      service.getMyNotifications(999, { page: 1, pageSize: 10 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns paginated notifications and unread count', async () => {
    prisma.thongBaoNguoiNhan.findMany.mockResolvedValue([mockNotification]);
    prisma.thongBaoNguoiNhan.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1); // unread

    const res = await service.getMyNotifications(42, {
      page: 1,
      pageSize: 10,
      unreadOnly: false,
    });

    expect(res.data).toHaveLength(1);
    expect(res.data[0].notificationId).toBe(101);
    expect(res.data[0].title).toBe('Đặt vé thành công');
    expect(res.data[0].isRead).toBe(false);
    expect(res.meta.unreadCount).toBe(1);
    expect(res.meta.totalPages).toBe(1);
  });

  it('marks a single notification as read by recipient ID strictly', async () => {
    prisma.thongBaoNguoiNhan.findFirst.mockResolvedValue(mockNotification);
    prisma.thongBaoNguoiNhan.update.mockResolvedValue({
      ...mockNotification,
      daDoc: true,
      thoiGianDoc: new Date('2026-10-06T07:10:00.000Z'),
    });

    const res = await service.markAsRead(42, 1);
    expect(res.isRead).toBe(true);
    expect(res.notificationId).toBe(101);
    expect(prisma.thongBaoNguoiNhan.findFirst).toHaveBeenCalledWith({
      where: {
        khachHangId: 10,
        thongBaoNguoiNhanId: 1,
      },
    });
    expect(prisma.thongBaoNguoiNhan.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when passing thongBaoId instead of thongBaoNguoiNhanId (ID collision prevention - discussion_r4222294124)', async () => {
    // If client passes 101 (which is thongBaoId, but not a valid thongBaoNguoiNhanId for customer 10)
    prisma.thongBaoNguoiNhan.findFirst.mockImplementation((args: any) => {
      if (args.where?.thongBaoNguoiNhanId === 101) {
        return Promise.resolve(null);
      }
      return Promise.resolve(mockNotification);
    });

    await expect(service.markAsRead(42, 101)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.thongBaoNguoiNhan.findFirst).toHaveBeenCalledWith({
      where: {
        khachHangId: 10,
        thongBaoNguoiNhanId: 101,
      },
    });
  });

  it('throws NotFoundException when notification not found for customer', async () => {
    prisma.thongBaoNguoiNhan.findFirst.mockResolvedValue(null);
    await expect(service.markAsRead(42, 999)).rejects.toThrow(NotFoundException);
  });

  it('marks all notifications as read', async () => {
    prisma.thongBaoNguoiNhan.updateMany.mockResolvedValue({ count: 5 });

    const res = await service.markAllAsRead(42);
    expect(res.isAllRead).toBe(true);
    expect(res.updatedCount).toBe(5);
  });
});
