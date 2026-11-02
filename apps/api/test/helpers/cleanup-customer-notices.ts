import type { Prisma } from '../../src/generated/prisma/client.js';

// Only fresh customer IDs owned by the invoking integration fixture.
export async function cleanupCustomerNotices(tx: Prisma.TransactionClient, customerIds: number[]) {
  if (!customerIds.length) return;
  const notices = await tx.thongBao.findMany({where:{nguoiNhans:{some:{khachHangId:{in:customerIds}}}},select:{thongBaoId:true,eventKey:true}});
  const ids = notices.map(n=>n.thongBaoId);
  const keys = notices.flatMap(n=>n.eventKey?[n.eventKey]:[]);
  await tx.pushThongBao.deleteMany({where:{khachHangId:{in:customerIds}}});
  await tx.thietBiThongBao.deleteMany({where:{khachHangId:{in:customerIds}}});
  await tx.emailThongBao.deleteMany({where:{eventKey:{in:keys}}});
  await tx.thongBaoNguoiNhan.deleteMany({where:{khachHangId:{in:customerIds}}});
  await tx.thongBao.deleteMany({where:{thongBaoId:{in:ids}}});
}
