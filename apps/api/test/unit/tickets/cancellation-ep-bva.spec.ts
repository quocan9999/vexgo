import { afterEach, describe, expect, it, vi } from 'vitest';
import { TicketsService } from '../../../src/tickets/tickets.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

const departure = Date.parse('2026-11-20T01:00:00Z'); // 08:00 Asia/Ho_Chi_Minh
function ticket() {
  return {
    veId: 1, maVe: 'QA-BVA-ONLY', giaThucTe: '250000', giaNiemYet: '250000',
    trangThai: 'DA_DAT', phieuDatVeId: 1,
    createdAt: new Date('2026-11-01T00:00:00Z'), updatedAt: new Date('2026-11-01T00:00:00Z'),
    phieuDatVe: { phieuDatVeId: 1, maPhieuDatVe: 'QA-BVA', trangThai: 'DA_THANH_TOAN',
      tongTienBanDau: '250000', soTienGiamKhuyenMai: '0',
      donGiaoDich: { trangThai: 'DA_THANH_TOAN', soDienThoaiKhachHang: '0900001234',
        phieuGuiHang: null as null | {trangThai:string}, thanhToans: [] } },
    gheChuyenXe: { ghe: { tenGhe: 'A01' }, chuyenXe: {
      chuyenXeId: 1, ngayKhoiHanh: new Date('2026-11-20T00:00:00Z'),
      gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
      tuyenXe: { diemDi:'TP.HCM', diemDen:'Đà Lạt', thoiGianChayPhut:420 } } },
  };
}
afterEach(()=>vi.useRealTimers());
describe('EP/BVA cancellation through TicketsService.lookupTicket (mocked storage)',()=>{
  const cases = [
    ['UNIT_CANCEL_0',0,false,0,'ALREADY_DEPARTED'],
    ['UNIT_CANCEL_1',1,false,0,'LESS_THAN_4_HOURS'],
    ['UNIT_CANCEL_8999',8999,false,0,'LESS_THAN_4_HOURS'],
    ['UNIT_CANCEL_9000',9000,true,0.2,null],
    ['UNIT_CANCEL_9001',9001,true,0.2,null],
    ['UNIT_CANCEL_86399',86399,true,0.2,null],
    ['UNIT_CANCEL_86400',86400,true,0.2,null],
    ['UNIT_CANCEL_86401',86401,true,0.1,null],
    ['UNIT_CANCEL_172800',172800,true,0.1,null],
  ] as const;
  it.each(cases)('%s — còn %s giây trước khởi hành',async(_id,seconds,eligible,rate,reason)=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(departure-seconds*1000);
    const record=ticket();
    const prisma={ve:{findUnique:vi.fn().mockResolvedValue(record),findMany:vi.fn().mockResolvedValue([record])}};
    const service=new TicketsService(prisma as unknown as PrismaService,{get:()=> 'Asia/Ho_Chi_Minh'} as unknown as ConfigService,{} as never);
    const result=await service.lookupTicket({ticketCode:'QA-BVA-ONLY',phoneNumber:'0900001234'});
    expect(result.data.cancellation).toMatchObject({eligible,cancelFeeRate:rate,cancelFee:eligible?250000*rate:0,refundAmount:eligible?250000*(1-rate):0});
    if(reason)expect(result.data.cancellation.reason).toBe(reason);
    expect(prisma.ve.findUnique).toHaveBeenCalledWith(expect.objectContaining({where:{maVe:'QA-BVA-ONLY'}}));
  });
  it('UNIT_CANCEL_ALREADY — vé đã hủy không được hủy lần nữa',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(departure-48*3600000);
    const record=ticket();record.trangThai='HUY';
    const service=new TicketsService({ve:{findUnique:vi.fn().mockResolvedValue(record),findMany:vi.fn().mockResolvedValue([record])}} as unknown as PrismaService,{get:()=> 'Asia/Ho_Chi_Minh'} as unknown as ConfigService,{} as never);
    const result=await service.lookupTicket({ticketCode:record.maVe,phoneNumber:'0900001234'});
    expect(result.data.cancellation).toMatchObject({eligible:false,reason:'ALREADY_CANCELLED',refundAmount:0});
  });
  it('UNIT_CANCEL_CARGO — đơn có hàng gửi còn hoạt động chặn hủy trực tuyến',async()=>{
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(departure-48*3600000);
    const record=ticket();record.phieuDatVe.donGiaoDich.phieuGuiHang={trangThai:'CHO_TIEP_NHAN'};
    const service=new TicketsService({ve:{findUnique:vi.fn().mockResolvedValue(record),findMany:vi.fn().mockResolvedValue([record])}} as unknown as PrismaService,{get:()=> 'Asia/Ho_Chi_Minh'} as unknown as ConfigService,{} as never);
    const result=await service.lookupTicket({ticketCode:record.maVe,phoneNumber:'0900001234'});
    expect(result.data.cancellation).toMatchObject({eligible:false,reason:'ACTIVE_SHIPMENT',refundAmount:0});
  });
});
