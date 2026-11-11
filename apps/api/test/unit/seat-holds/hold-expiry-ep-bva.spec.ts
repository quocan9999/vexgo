import {afterEach,describe,expect,it,vi} from 'vitest';
import {SeatHoldsService} from '../../../src/seat-holds/seat-holds.service.js';
import type {PrismaService} from '../../../src/prisma/prisma.service.js';

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();});
describe('BVA seat hold expiry with fake clock (mocked storage)',()=>{
  it.each([599999,600000,600001])('UNIT_HOLD_%s — kiểm tra sau %s ms',async(elapsed)=>{
    vi.useFakeTimers();const now=Date.parse('2026-11-20T00:00:00Z');vi.setSystemTime(now);
    const seats=[{gheChuyenXeId:101,chuyenXeId:50,gheId:1,trangThai:'TRONG',ghe:{soGhe:'A01'}}];
    const prisma={
      chuyenXe:{findUnique:vi.fn().mockResolvedValue({chuyenXeId:50,trangThai:'CHUA_KHOI_HANH',ngayKhoiHanh:new Date('2026-11-21T00:00:00Z'),gioKhoiHanh:new Date('1970-01-01T08:00:00Z')})},
      gheChuyenXe:{findMany:vi.fn().mockResolvedValue(seats),findFirst:vi.fn().mockResolvedValue(null),updateMany:vi.fn().mockResolvedValue({count:1})},
      giuCho:{create:vi.fn().mockResolvedValue({giuChoId:1}),findMany:vi.fn().mockResolvedValue([])},
      $transaction:vi.fn(),
    };
    prisma.$transaction.mockImplementation(async(cb:(tx:typeof prisma)=>Promise<unknown>)=>cb(prisma));
    const service=new SeatHoldsService(prisma as unknown as PrismaService);
    const hold=await service.createSeatHold(50,[101]);
    expect(Date.parse(hold.expiresAt)-now).toBe(600000);
    vi.setSystemTime(now+elapsed);
    if(elapsed<600000)expect(()=>service.verifyHold(hold.holdToken,50,[101],null)).not.toThrow();
    else expect(()=>service.verifyHold(hold.holdToken,50,[101],null)).toThrow(expect.objectContaining({response:expect.objectContaining({error:'HOLD_EXPIRED'})}));
  });
});
