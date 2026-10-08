import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { ExecutionContext, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { MomoWebhookDto, VnpayWebhookDto } from '../../../src/payments/dto/webhook.dto.js';

import { Reflector } from '@nestjs/core';
import { AUTH_MODE_KEY, type EndpointAuthMode } from '../../../src/auth/decorators/public.decorator.js';

describe('Payments Webhook & Status Security with MySQL (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let customerAId: number;
  let customerBId: number;
  let customerAPrincipal: AuthPrincipal;
  let customerBPrincipal: AuthPrincipal;
  let currentPrincipal: AuthPrincipal | null = null;

  beforeAll(async () => {
    let reflector: Reflector;
    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        const authMode = reflector?.getAllAndOverride<EndpointAuthMode>(AUTH_MODE_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);
        if (authMode === 'public' || authMode === 'optional') {
          if (currentPrincipal) {
            context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
              currentPrincipal;
          }
          return true;
        }

        if (currentPrincipal) {
          context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
            currentPrincipal;
          return true;
        }
        return false;
      },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(accessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();

    reflector = app.get(Reflector);

    prisma = app.get(PrismaService);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();

    // Create Bus Company
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-PAY-${suffix}`,
        tenNhaXe: `Payments Test Co ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;

    // Create Customer A
    const accountA = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8495${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Payer A ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-PA-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerAId = accountA.khachHang!.khachHangId;
    customerAPrincipal = {
      taiKhoanId: accountA.taiKhoanId,
      sessionId: `sess-pa-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    // Create Customer B
    const accountB = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8496${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Payer B ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-PB-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerBId = accountB.khachHang!.khachHangId;
    customerBPrincipal = {
      taiKhoanId: accountB.taiKhoanId,
      sessionId: `sess-pb-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma.thanhToan.deleteMany({
        where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
      });
      await prisma.phieuDatVe.deleteMany({
        where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
      });
      await prisma.donGiaoDich.deleteMany({
        where: { khachHangId: { in: [customerAId, customerBId] } },
      });
      await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyId } });

      await prisma.khachHang.deleteMany({ where: { khachHangId: { in: [customerAId, customerBId] } } });
      await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: { in: [customerAPrincipal.taiKhoanId, customerBPrincipal.taiKhoanId] } } });
    } finally {
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;
    await prisma.thanhToan.deleteMany({
      where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
    });
    await prisma.phieuDatVe.deleteMany({
      where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
    });
    await prisma.donGiaoDich.deleteMany({
      where: { khachHangId: { in: [customerAId, customerBId] } },
    });
  });

  async function createTestPayment(customerId: number, provider = 'MOMO') {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const donGiaoDich = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `DGD-PAY-${suffix}`,
        ngayTao: new Date(),
        tongTien: 200000,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: 'Payer Customer',
        soDienThoaiKhachHang: '+84950000001',
        khachHangId: customerId,
        nhaXeId: busCompanyId,
        phieuDatVe: {
          create: {
            maPhieuDatVe: `PDV-PAY-${suffix}`,
            ngayDat: new Date(),
            soLuongVeBanDau: 1,
            tongTienBanDau: 200000,
            trangThai: 'CHO_THANH_TOAN',
          },
        },
      },
      include: { phieuDatVe: true },
    });

    const thanhToan = await prisma.thanhToan.create({
      data: {
        soTien: 200000,
        phuongThuc: provider,
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: new Date(),
        trangThai: 'DANG_XU_LY',
        donGiaoDichId: donGiaoDich.donGiaoDichId,
      },
    });

    return { donGiaoDich, phieuDatVe: donGiaoDich.phieuDatVe!, thanhToan };
  }

  function buildMomoPayload(paymentId: number, options: Partial<MomoWebhookDto> = {}) {
    const secret = 'vexgo_momo_demo_secret';
    const base: MomoWebhookDto = {
      partnerCode: 'MOMO',
      orderId: String(paymentId),
      requestId: `REQ-${paymentId}`,
      amount: 200000,
      orderInfo: `Thanh toan ve #${paymentId}`,
      orderType: 'momo_wallet',
      transId: 987654321,
      resultCode: 0,
      message: 'Thành công',
      payType: 'qr',
      responseTime: Date.now(),
      extraData: String(paymentId),
      accessKey: 'DEMO_ACCESS_KEY',
      ...options,
    };

    const raw = `accessKey=${base.accessKey ?? ''}&amount=${base.amount ?? ''}&extraData=${base.extraData ?? ''}&message=${base.message ?? ''}&orderId=${base.orderId ?? ''}&orderInfo=${base.orderInfo ?? ''}&orderType=${base.orderType ?? ''}&partnerCode=${base.partnerCode ?? ''}&payType=${base.payType ?? ''}&requestId=${base.requestId ?? ''}&responseTime=${base.responseTime ?? ''}&resultCode=${base.resultCode ?? ''}&transId=${base.transId ?? ''}`;
    const signature = createHmac('sha256', secret).update(raw).digest('hex');

    return { ...base, signature };
  }

  function buildVnpayPayload(paymentId: number, options: Partial<VnpayWebhookDto> = {}) {
    const secret = 'vexgo_vnpay_demo_secret';
    const base: Record<string, any> = {
      vnp_Amount: '20000000',
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: 'VNP123456',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan ve #${paymentId}`,
      vnp_PayDate: '20261008200000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'DEMOTMN',
      vnp_TransactionNo: '14123456',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: String(paymentId),
      ...options,
    };

    const entries = Object.entries(base)
      .filter(([k, v]) => k.startsWith('vnp_') && v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b));

    const signData = entries
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
      .join('&');

    const vnp_SecureHash = createHmac('sha512', secret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    return { ...base, vnp_SecureHash } as VnpayWebhookDto;
  }

  it('valid MoMo webhook signature confirms payment, transaction, and booking to success atomically', async () => {
    const { thanhToan, donGiaoDich, phieuDatVe } = await createTestPayment(customerAId, 'MOMO');

    const payload = buildMomoPayload(thanhToan.thanhToanId);

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);

    expect(res.status).toBe(201); // Nest POST default
    const body = res.body.data ?? res.body;
    expect(body.resultCode).toBe(0);

    // Database verification: atomic transition to THANH_CONG / DA_THANH_TOAN
    const updatedPayment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(updatedPayment?.trangThai).toBe('THANH_CONG');

    const updatedTx = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(updatedTx?.trangThai).toBe('DA_THANH_TOAN');

    const updatedBooking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(updatedBooking?.trangThai).toBe('DA_THANH_TOAN');
  });

  it('rejects MoMo webhook with invalid or forged signature with 400 Bad Request without mutating DB', async () => {
    const { thanhToan, donGiaoDich, phieuDatVe } = await createTestPayment(customerAId, 'MOMO');

    const forgedPayload = {
      ...buildMomoPayload(thanhToan.thanhToanId),
      signature: 'bad_forged_signature_1234567890abcdef',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(forgedPayload);

    expect(res.status).toBe(400);

    // DB remains unchanged in MySQL
    const payment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(payment?.trangThai).toBe('DANG_XU_LY');

    const tx = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(tx?.trangThai).toBe('CHO_THANH_TOAN');

    const booking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(booking?.trangThai).toBe('CHO_THANH_TOAN');
  });

  it('valid VNPay webhook signature confirms payment atomically', async () => {
    const { thanhToan, donGiaoDich, phieuDatVe } = await createTestPayment(customerAId, 'VNPAY');

    const payload = buildVnpayPayload(thanhToan.thanhToanId);

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/vnpay/webhook')
      .send(payload);

    expect(res.status).toBe(201);
    const body = res.body.data ?? res.body;
    expect(body.RspCode).toBe('00');

    // DB verification
    const updatedPayment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(updatedPayment?.trangThai).toBe('THANH_CONG');

    const updatedTx = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(updatedTx?.trangThai).toBe('DA_THANH_TOAN');

    const updatedBooking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(updatedBooking?.trangThai).toBe('DA_THANH_TOAN');
  });

  it('duplicate webhook is idempotent and does not error', async () => {
    const { thanhToan } = await createTestPayment(customerAId, 'MOMO');
    const payload = buildMomoPayload(thanhToan.thanhToanId);

    // First webhook call
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);
    expect(res1.status).toBe(201);

    // Second webhook call (idempotent duplicate retry from gateway)
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);
    expect(res2.status).toBe(201);
    const body2 = res2.body.data ?? res2.body;
    expect(body2.resultCode).toBe(0);

    const payment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(payment?.trangThai).toBe('THANH_CONG');
  });

  it('getPaymentStatus is read-only and enforces customer ownership', async () => {
    const { thanhToan } = await createTestPayment(customerAId, 'MOMO');

    // Customer A queries own payment status -> 200 OK, status PENDING
    currentPrincipal = customerAPrincipal;
    const resA = await request(app.getHttpServer())
      .get(`/api/v1/payments/${thanhToan.thanhToanId}/status`);
    expect(resA.status).toBe(200);
    const bodyA = resA.body.data ?? resA.body;
    expect(bodyA.status).toBe('PENDING');
    expect(bodyA.amount).toBe(200000);

    // Verify DB was NOT mutated by status polling
    const paymentUnchanged = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(paymentUnchanged?.trangThai).toBe('DANG_XU_LY');

    // Customer B attempts to query Customer A's payment status -> 403 Forbidden
    currentPrincipal = customerBPrincipal;
    const resB = await request(app.getHttpServer())
      .get(`/api/v1/payments/${thanhToan.thanhToanId}/status`);
    expect(resB.status).toBe(403);
    expect(resB.body.error).toBe('FORBIDDEN');
  });
});
