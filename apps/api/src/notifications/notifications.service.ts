import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomer(taiKhoanId: number) {
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId },
      select: { khachHangId: true },
    });

    if (!customer) {
      throw new ForbiddenException('Tài khoản không phải là khách hàng hợp lệ.');
    }

    return customer;
  }

  async getMyNotifications(
    taiKhoanId: number,
    query: GetNotificationsQueryDto,
  ) {
    const customer = await this.resolveCustomer(taiKhoanId);
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const where: Prisma.ThongBaoNguoiNhanWhereInput = {
      khachHangId: customer.khachHangId,
      ...(query.unreadOnly ? { daDoc: false } : {}),
    };

    const [items, totalItems, unreadCount] = await Promise.all([
      this.prisma.thongBaoNguoiNhan.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          thongBao: true,
        },
        orderBy: {
          thongBao: {
            thoiGian: 'desc',
          },
        },
      }),
      this.prisma.thongBaoNguoiNhan.count({ where }),
      this.prisma.thongBaoNguoiNhan.count({
        where: {
          khachHangId: customer.khachHangId,
          daDoc: false,
        },
      }),
    ]);

    const mapped = items.map((item) => ({
      id: item.thongBaoNguoiNhanId,
      notificationId: item.thongBaoId,
      title: item.thongBao.tieuDe,
      content: item.thongBao.noiDung,
      createdAt: item.thongBao.thoiGian.toISOString(),
      isRead: item.daDoc,
      readAt: item.thoiGianDoc ? item.thoiGianDoc.toISOString() : null,
      type: item.thongBao.trangThai,
    }));

    return {
      data: mapped,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize) || 1,
        unreadCount,
      },
    };
  }

  async markAsRead(taiKhoanId: number, id: number) {
    const customer = await this.resolveCustomer(taiKhoanId);

    const recipientRecord = await this.prisma.thongBaoNguoiNhan.findFirst({
      where: {
        khachHangId: customer.khachHangId,
        thongBaoNguoiNhanId: id,
      },
    });

    if (!recipientRecord) {
      throw new NotFoundException(
        'Thông báo không tồn tại hoặc không thuộc quyền sở hữu của bạn.',
      );
    }

    const readAt = new Date();
    const updated = await this.prisma.thongBaoNguoiNhan.update({
      where: {
        thongBaoNguoiNhanId: recipientRecord.thongBaoNguoiNhanId,
      },
      data: {
        daDoc: true,
        thoiGianDoc: readAt,
      },
    });

    return {
      id: updated.thongBaoNguoiNhanId,
      notificationId: updated.thongBaoId,
      isRead: true,
      readAt: updated.thoiGianDoc?.toISOString() ?? readAt.toISOString(),
    };
  }

  async markAllAsRead(taiKhoanId: number) {
    const customer = await this.resolveCustomer(taiKhoanId);
    const readAt = new Date();

    const result = await this.prisma.thongBaoNguoiNhan.updateMany({
      where: {
        khachHangId: customer.khachHangId,
        daDoc: false,
      },
      data: {
        daDoc: true,
        thoiGianDoc: readAt,
      },
    });

    return {
      updatedCount: result.count,
      isAllRead: true,
    };
  }
}
