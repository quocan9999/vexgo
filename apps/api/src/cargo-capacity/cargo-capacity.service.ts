import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

export const CARGO_CAPACITY_GROUPS = [
  'XE_MAY',
  'HANG_CONG_KENH',
  'HANG_NHE',
] as const;

export type CargoCapacityGroup = (typeof CARGO_CAPACITY_GROUPS)[number];

export type CargoCapacityTrip = {
  chuyenXeId: number;
  trangThai: string;
  nhanGuiHang: boolean;
  sucChuaXeMay: number;
  sucChuaHangCongKenh: number;
  sucChuaHangNhe: number;
};

export type CargoCapacitySnapshot = {
  trip: CargoCapacityTrip;
  capacities: Record<
    CargoCapacityGroup,
    { total: number; used: number; remaining: number }
  >;
};

export type CargoCapacityRequest = {
  group: CargoCapacityGroup;
  quantity: number;
};

type CargoCapacityReader = Pick<
  Prisma.TransactionClient,
  'chuyenXe' | 'hangHoa'
>;
type CargoCapacityLock = Pick<Prisma.TransactionClient, '$queryRaw'>;

const CAPACITY_GROUP_TOTAL: Record<
  CargoCapacityGroup,
  'sucChuaXeMay' | 'sucChuaHangCongKenh' | 'sucChuaHangNhe'
> = {
  XE_MAY: 'sucChuaXeMay',
  HANG_CONG_KENH: 'sucChuaHangCongKenh',
  HANG_NHE: 'sucChuaHangNhe',
};

const ACTIVE_SHIPMENT_STATUSES = [
  'MOI_TAO',
  'DA_TIEP_NHAN',
  'DANG_VAN_CHUYEN',
] as const;

const CAPACITY_GROUP_LABEL: Record<CargoCapacityGroup, string> = {
  XE_MAY: 'xe máy',
  HANG_CONG_KENH: 'hàng cồng kềnh',
  HANG_NHE: 'hàng nhẹ',
};

@Injectable()
export class CargoCapacityService {
  async lockTrip(tx: CargoCapacityLock, tripId: number): Promise<void> {
    const lockedTrips = await tx.$queryRaw<Array<{ chuyenXeId: number }>>`
      SELECT chuyenXeId
      FROM ChuyenXe
      WHERE chuyenXeId = ${tripId}
      FOR UPDATE
    `;

    if (lockedTrips.length !== 1) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }
  }

  async getSnapshot(
    db: CargoCapacityReader,
    tripId: number,
  ): Promise<CargoCapacitySnapshot | null> {
    const trip = await db.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
      select: {
        chuyenXeId: true,
        trangThai: true,
        nhanGuiHang: true,
        sucChuaXeMay: true,
        sucChuaHangCongKenh: true,
        sucChuaHangNhe: true,
      },
    });

    if (!trip) return null;

    const used: Record<CargoCapacityGroup, number> = {
      XE_MAY: 0,
      HANG_CONG_KENH: 0,
      HANG_NHE: 0,
    };

    if (trip.nhanGuiHang) {
      const activeItems = await db.hangHoa.findMany({
        where: {
          phieuGuiHang: {
            chuyenXeId: tripId,
            trangThai: { in: [...ACTIVE_SHIPMENT_STATUSES] },
          },
        },
        select: {
          soLuong: true,
          loaiHangHoa: { select: { nhomSucChua: true } },
        },
      });

      for (const item of activeItems) {
        used[item.loaiHangHoa.nhomSucChua] += item.soLuong;
      }
    }

    const capacities = Object.fromEntries(
      CARGO_CAPACITY_GROUPS.map((group) => {
        const total = trip.nhanGuiHang ? trip[CAPACITY_GROUP_TOTAL[group]] : 0;
        const groupUsed = used[group];
        return [
          group,
          { total, used: groupUsed, remaining: Math.max(0, total - groupUsed) },
        ];
      }),
    ) as CargoCapacitySnapshot['capacities'];

    return { trip, capacities };
  }

  assertAvailable(
    snapshot: CargoCapacitySnapshot,
    request: CargoCapacityRequest[],
  ): void {
    if (snapshot.trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở tiếp nhận hàng.',
      });
    }

    if (!snapshot.trip.nhanGuiHang) {
      throw new ConflictException({
        error: 'TRIP_DOES_NOT_ACCEPT_CARGO',
        message: 'Chuyến xe này không hỗ trợ nhận gửi hàng.',
      });
    }

    const requested: Record<CargoCapacityGroup, number> = {
      XE_MAY: 0,
      HANG_CONG_KENH: 0,
      HANG_NHE: 0,
    };

    for (const item of request) {
      requested[item.group] += item.quantity;
    }

    for (const group of CARGO_CAPACITY_GROUPS) {
      if (
        snapshot.capacities[group].used + requested[group] >
        snapshot.capacities[group].total
      ) {
        throw new ConflictException({
          error: 'CARGO_CAPACITY_EXCEEDED',
          message: `Chuyến xe đã hết chỗ chứa ${CAPACITY_GROUP_LABEL[group]}.`,
        });
      }
    }
  }
}
