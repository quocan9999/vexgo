import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AiChatbotOrchestratorService } from '../../../src/ai-chatbot/orchestrator/ai-chatbot-orchestrator.service.js';
import { AiBusinessToolsService } from '../../../src/ai-chatbot/tools/ai-business-tools.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { LocationsService } from '../../../src/locations/locations.service.js';

describe('AI Chatbot Trip Search - Flexible Date & Location Normalization', () => {
  const orchestrator = new AiChatbotOrchestratorService(
    new ConfigService({}),
    {} as any,
    {} as any,
    {} as any,
  );

  describe('extractDateFromMessage & parseTripSearchQuery', () => {
    it('1. should parse DD/MM/YYYY format correctly', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm xe từ Sài Gòn đi Đà Lạt ngày 15/11/2026',
      );
      expect(parsed.origin).toBe('sài gòn');
      expect(parsed.destination).toBe('đà lạt');
      expect(parsed.date).toBe('2026-11-15');
    });

    it('2. should parse DD-MM-YYYY format correctly', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm xe từ Hồ Chí Minh đi Đà Lạt ngày 15-11-2026',
      );
      expect(parsed.origin).toBe('hồ chí minh');
      expect(parsed.destination).toBe('đà lạt');
      expect(parsed.date).toBe('2026-11-15');
    });

    it('3. should parse DD.MM.YYYY format correctly with province Lâm Đồng', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm xe từ Hồ Chí Minh đi Lâm Đồng ngày 15.11.2026',
      );
      expect(parsed.origin).toBe('hồ chí minh');
      expect(parsed.destination).toBe('lâm đồng');
      expect(parsed.date).toBe('2026-11-15');
    });

    it('4. should parse Vietnamese text date "ngày 15 tháng 11 năm 2026"', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm vé xe từ Hà Nội đi Đà Nẵng ngày 15 tháng 11 năm 2026',
      );
      expect(parsed.origin).toBe('hà nội');
      expect(parsed.destination).toBe('đà nẵng');
      expect(parsed.date).toBe('2026-11-15');
    });

    it('5. should parse relative date "ngày mai" with mock reference date', () => {
      const refDate = new Date('2026-11-09T00:00:00.000Z');
      const dateRes = orchestrator.extractDateFromMessage('Tìm xe ngày mai', refDate);
      expect(dateRes.date).toBe('2026-11-10');
    });

    it('6. should extract destination when user only asks "đi Đà Lạt ngày 15/11/2026"', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm chuyến xe đi Đà Lạt ngày 15/11/2026',
      );
      expect(parsed.destination).toBe('đà lạt');
      expect(parsed.date).toBe('2026-11-15');
    });

    it('7. should extract time filter "có chuyến xe nào đi muộn không?" without mistaking "muộn không" for destination', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'có chuyến xe nào đi muộn không?',
      );
      expect(parsed.origin).toBe('');
      expect(parsed.destination).toBe('');
      expect(parsed.preferLate).toBe(true);
      expect(parsed.timeOfDay).toBe('TOI');
    });

    it('8. should extract time filter "có chuyến xe nào đi tầm 18:00 trở đi không" without mistaking time phrase for destination', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'có chuyến xe nào đi tầm 18:00 trở đi không',
      );
      expect(parsed.origin).toBe('');
      expect(parsed.destination).toBe('');
      expect(parsed.minHour).toBe(18);
      expect(parsed.preferLate).toBe(true);
    });

    it('9. should extract "sau 18h" and "trước 10h sáng"', () => {
      const parsedAfter = orchestrator.parseTripSearchQuery(
        'có chuyến xe sau 18h không',
      );
      expect(parsedAfter.minHour).toBe(18);
      expect(parsedAfter.preferLate).toBe(true);
      expect(parsedAfter.destination).toBe('');

      const parsedBefore = orchestrator.parseTripSearchQuery(
        'chuyến trước 10h sáng đi Vũng Tàu',
      );
      expect(parsedBefore.maxHour).toBe(10);
      expect(parsedBefore.timeOfDay).toBe('SANG');
      expect(parsedBefore.preferEarly).toBe(true);
      expect(parsedBefore.destination).toBe('vũng tàu');
    });
  });

  describe('AiBusinessToolsService.searchAvailableTrips', () => {
    it('10. should expand location synonyms (Sài Gòn / Hồ Chí Minh -> TP.HCM, Lâm Đồng -> Đà Lạt)', async () => {
      const mockPrisma = {
        chuyenXe: {
          findMany: vi.fn().mockResolvedValue([
            {
              chuyenXeId: 101,
              maChuyenXe: 'CX-TEST-001',
              tuyenXe: {
                tenTuyen: 'TP.HCM - Đà Lạt',
                nhaXe: { tenNhaXe: 'Phương Trang' },
              },
              xe: {
                loaiXe: { tenLoai: 'Giường nằm 36 chỗ' },
                loaiXeId: 1,
              },
              gioKhoiHanh: new Date('2026-11-15T04:30:00.000Z'),
              gioDen: new Date('2026-11-15T11:30:00.000Z'),
              ngayKhoiHanh: new Date('2026-11-15T00:00:00.000Z'),
              nhaXeId: 1,
              tuyenXeId: 1,
              gheChuyenXes: [{ trangThai: 'TRONG' }, { trangThai: 'TRONG' }],
            },
          ]),
        },
        bangGia: {
          findMany: vi.fn().mockResolvedValue([
            {
              nhaXeId: 1,
              tuyenXeId: 1,
              loaiXeId: 1,
              giaNiemYet: 250000,
              tuNgay: new Date('2026-01-01'),
              denNgay: null,
            },
          ]),
        },
      } as unknown as PrismaService;

      const mockLocations = {
        list: vi.fn().mockResolvedValue({
          data: [
            {
              name: 'TP. Hồ Chí Minh',
              value: 'TP.HCM',
              aliases: ['Hồ Chí Minh', 'Sài Gòn', 'HCM'],
              isLegacy: false,
              kind: 'province',
            },
            {
              name: 'Lâm Đồng',
              value: 'Lâm Đồng',
              aliases: ['Đà Lạt', 'Bảo Lộc'],
              isLegacy: false,
              kind: 'province',
            },
          ],
        }),
      } as unknown as LocationsService;

      const toolsService = new AiBusinessToolsService(
        mockPrisma,
        undefined,
        undefined,
        undefined,
        undefined,
        mockLocations,
      );

      const result = await toolsService.searchAvailableTrips({
        originQuery: 'Hồ Chí Minh',
        destinationQuery: 'Lâm Đồng',
        departureDate: '15/11/2026',
      });

      expect(mockPrisma.chuyenXe.findMany).toHaveBeenCalled();
      const findArgs = vi.mocked(mockPrisma.chuyenXe.findMany).mock.calls[0][0];

      // Verify date normalized to 2026-11-15T00:00:00.000Z
      expect(findArgs?.where?.ngayKhoiHanh).toEqual(
        new Date('2026-11-15T00:00:00.000Z'),
      );

      // Verify OR filters contain expanded synonyms matching DB values
      const andFilters = findArgs?.where?.AND as any[];
      expect(andFilters).toBeDefined();

      const originFilter = andFilters.find((f: any) => f.tuyenXe?.OR?.some((o: any) => o.diemDi));
      const originTerms = originFilter.tuyenXe.OR.map((o: any) => o.diemDi.contains);
      expect(originTerms).toContain('TP.HCM');
      expect(originTerms).toContain('Hồ Chí Minh');
      expect(originTerms).toContain('Sài Gòn');

      const destFilter = andFilters.find((f: any) => f.tuyenXe?.OR?.some((d: any) => d.diemDen));
      const destTerms = destFilter.tuyenXe.OR.map((d: any) => d.diemDen.contains);
      expect(destTerms).toContain('Đà Lạt');
      expect(destTerms).toContain('Lâm Đồng');

      expect(result.totalFound).toBe(1);
      expect(result.trips[0].operator).toBe('Phương Trang');
      expect(result.trips[0].price).toBe(250000);
    });

    it('11. should filter trips by minHour / timeOfDay and calculate allDayTotal & timeSpan correctly', async () => {
      const mockTrips = [
        {
          chuyenXeId: 1,
          maChuyenXe: 'CX-0600',
          tuyenXe: {
            tenTuyen: 'TP.HCM - Đà Lạt',
            nhaXe: { tenNhaXe: 'Thành Bưởi' },
            diemDi: 'TP.HCM',
            diemDen: 'Đà Lạt',
          },
          xe: { loaiXe: { tenLoai: 'Giường nằm' }, loaiXeId: 1 },
          gioKhoiHanh: new Date('1970-01-01T06:00:00.000Z'),
          gioDen: new Date('1970-01-01T13:00:00.000Z'),
          ngayKhoiHanh: new Date('2026-11-15T00:00:00.000Z'),
          nhaXeId: 1,
          tuyenXeId: 1,
          gheChuyenXes: [{ trangThai: 'TRONG' }, { trangThai: 'TRONG' }],
        },
        {
          chuyenXeId: 2,
          maChuyenXe: 'CX-0800',
          tuyenXe: {
            tenTuyen: 'TP.HCM - Đà Lạt',
            nhaXe: { tenNhaXe: 'Phương Trang' },
            diemDi: 'TP.HCM',
            diemDen: 'Đà Lạt',
          },
          xe: { loaiXe: { tenLoai: 'Ghế ngồi' }, loaiXeId: 2 },
          gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
          gioDen: new Date('1970-01-01T15:00:00.000Z'),
          ngayKhoiHanh: new Date('2026-11-15T00:00:00.000Z'),
          nhaXeId: 2,
          tuyenXeId: 1,
          gheChuyenXes: [{ trangThai: 'TRONG' }],
        },
        {
          chuyenXeId: 3,
          maChuyenXe: 'CX-1800',
          tuyenXe: {
            tenTuyen: 'TP.HCM - Đà Lạt',
            nhaXe: { tenNhaXe: 'Thành Bưởi' },
            diemDi: 'TP.HCM',
            diemDen: 'Đà Lạt',
          },
          xe: { loaiXe: { tenLoai: 'Giường nằm' }, loaiXeId: 1 },
          gioKhoiHanh: new Date('1970-01-01T18:00:00.000Z'),
          gioDen: new Date('1970-01-01T01:00:00.000Z'),
          ngayKhoiHanh: new Date('2026-11-15T00:00:00.000Z'),
          nhaXeId: 1,
          tuyenXeId: 1,
          gheChuyenXes: [{ trangThai: 'TRONG' }, { trangThai: 'TRONG' }],
        },
        {
          chuyenXeId: 4,
          maChuyenXe: 'CX-2000',
          tuyenXe: {
            tenTuyen: 'TP.HCM - Đà Lạt',
            nhaXe: { tenNhaXe: 'Hoa Mai' },
            diemDi: 'TP.HCM',
            diemDen: 'Đà Lạt',
          },
          xe: { loaiXe: { tenLoai: 'Limousine' }, loaiXeId: 3 },
          gioKhoiHanh: new Date('1970-01-01T20:00:00.000Z'),
          gioDen: new Date('1970-01-01T03:00:00.000Z'),
          ngayKhoiHanh: new Date('2026-11-15T00:00:00.000Z'),
          nhaXeId: 3,
          tuyenXeId: 1,
          gheChuyenXes: [{ trangThai: 'TRONG' }],
        },
      ];

      const mockPrisma = {
        chuyenXe: { findMany: vi.fn().mockResolvedValue(mockTrips) },
        bangGia: { findMany: vi.fn().mockResolvedValue([]) },
      } as unknown as PrismaService;

      const toolsService = new AiBusinessToolsService(
        mockPrisma,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      );

      // 11.1 Tìm kiếm thông thường không có bộ lọc giờ
      const allRes = await toolsService.searchAvailableTrips({
        originQuery: 'TP.HCM',
        destinationQuery: 'Đà Lạt',
        departureDate: '15/11/2026',
      });
      expect(allRes.allDayTotal).toBe(4);
      expect(allRes.timeSpan).toBe('06:00 - 20:00');
      expect(allRes.totalFound).toBe(4);

      // 11.2 Tìm chuyến đi muộn từ 18:00 trở đi
      const lateRes = await toolsService.searchAvailableTrips({
        originQuery: 'TP.HCM',
        destinationQuery: 'Đà Lạt',
        departureDate: '15/11/2026',
        minHour: 18,
        preferLate: true,
      });
      expect(lateRes.allDayTotal).toBe(4);
      expect(lateRes.totalFound).toBe(2);
      expect(lateRes.trips.map((t) => t.departureTime)).toEqual(['18:00', '20:00']);
      expect(lateRes.summary).toContain('Tìm thấy 2 chuyến xe phù hợp với khung giờ yêu cầu');
    });
  });

  describe('Round-Trip Search & Recommendation Flow', () => {
    it('12. should parse single-turn round-trip query with departure and return date', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm vé khứ hồi từ Hồ Chí Minh đi Đà Lạt đi ngày 15/11/2026 về ngày 18/11/2026',
      );
      expect(parsed.origin).toBe('hồ chí minh');
      expect(parsed.destination).toBe('đà lạt');
      expect(parsed.date).toBe('2026-11-15');
      expect(parsed.returnDate).toBe('2026-11-18');
      expect(parsed.isRoundTrip).toBe(true);
    });

    it('13. should parse compact round-trip query "Tìm xe khứ hồi Sài Gòn - Đà Lạt đi 15/11 về 18/11"', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Tìm xe khứ hồi Sài Gòn - Đà Lạt đi 15/11 về 18/11',
      );
      expect(parsed.origin).toBe('sài gòn');
      expect(parsed.destination).toBe('đà lạt');
      expect(parsed.date).toBe('2026-11-15');
      expect(parsed.returnDate).toBe('2026-11-18');
      expect(parsed.isRoundTrip).toBe(true);
    });

    it('14. should detect return-only query "Có chuyến về ngày 18/11 không?"', () => {
      const parsed = orchestrator.parseTripSearchQuery(
        'Có chuyến về ngày 18/11 không?',
      );
      expect(parsed.isReturnTripOnly).toBe(true);
      expect(parsed.returnDate).toBe('2026-11-18');
    });

    it('15. should validate invalid date sequence (returnDate < departureDate)', async () => {
      const mockPrisma = {
        aiChatSession: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
          update: vi.fn(),
        },
        aiChatMessage: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;

      const testOrchestrator = new AiChatbotOrchestratorService(
        new ConfigService({}),
        {} as any,
        {} as any,
        mockPrisma,
      );

      const res = await testOrchestrator.processUserMessage({
        message: 'Tìm vé khứ hồi HCM đi Đà Lạt đi 18/11/2026 về 15/11/2026',
        sessionToken: '11111111-1111-4111-8111-111111111111',
      });

      expect(res.reply).toContain('Ngày về (15/11/2026) không thể trước ngày khởi hành (18/11/2026)');
      expect(res.intent).toBe('TRIP_SEARCH');
      expect(res.suggestedTrips).toBeUndefined();
    });

    it('16. should execute parallel search for round-trip and populate return trips and booking URL', async () => {
      const mockPrisma = {
        aiChatSession: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
          update: vi.fn(),
        },
        aiChatMessage: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
          findMany: vi.fn().mockResolvedValue([]),
        },
      } as unknown as PrismaService;

      const mockBusinessTools = {
        searchAvailableTrips: vi.fn().mockImplementation(async (params) => {
          if (params.departureDate === '2026-11-15') {
            return {
              summary: 'Chiều đi có 1 chuyến',
              allDayTotal: 1,
              trips: [
                {
                  tripId: 101,
                  operator: 'Thành Bưởi',
                  origin: 'TP.HCM',
                  destination: 'Đà Lạt',
                  departureDate: '2026-11-15',
                  departureTime: '06:00',
                  vehicleType: 'GIƯỜNG NẰM',
                  price: 270000,
                  availableSeats: 20,
                  bookingUrl: '/trips/101',
                },
              ],
            };
          } else {
            return {
              summary: 'Chiều về có 1 chuyến',
              allDayTotal: 1,
              trips: [
                {
                  tripId: 202,
                  operator: 'Phương Trang',
                  origin: 'Đà Lạt',
                  destination: 'TP.HCM',
                  departureDate: '2026-11-18',
                  departureTime: '13:00',
                  vehicleType: 'LIMOUSINE',
                  price: 330000,
                  availableSeats: 15,
                  bookingUrl: '/trips/202',
                },
              ],
            };
          }
        }),
      } as unknown as AiBusinessToolsService;

      const mockRetrieval = {
        retrieve: vi.fn().mockResolvedValue([]),
      } as any;

      const testOrchestrator = new AiChatbotOrchestratorService(
        new ConfigService({}),
        mockRetrieval,
        mockBusinessTools,
        mockPrisma,
      );

      const res = await testOrchestrator.processUserMessage({
        message: 'Tìm vé khứ hồi HCM đi Đà Lạt đi 15/11/2026 về 18/11/2026',
        sessionToken: '11111111-1111-4111-8111-111111111111',
      });

      expect(res.isRoundTrip).toBe(true);
      expect(res.suggestedTrips?.length).toBe(1);
      expect(res.suggestedTrips?.[0].operator).toBe('Thành Bưởi');
      expect(res.suggestedReturnTrips?.length).toBe(1);
      expect(res.suggestedReturnTrips?.[0].operator).toBe('Phương Trang');
      expect(res.roundTripBookingUrl).toContain('tripType=round-trip');
      expect(res.roundTripBookingUrl).toContain('date=2026-11-15');
      expect(res.roundTripBookingUrl).toContain('returnDate=2026-11-18');
      expect(res.reply).toContain('Chiều đi:');
      expect(res.reply).toContain('Chiều về:');
      expect(res.reply).toContain('Đặt vé khứ hồi');
    });

    it('17. should NOT inherit return trip when user sends a standalone one-way query in a session that previously had round-trip queries', async () => {
      const mockPrisma = {
        aiChatSession: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
          update: vi.fn(),
        },
        aiChatMessage: {
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, ...data })),
          // Giả lập lịch sử trước đó từng có câu hỏi khứ hồi
          findMany: vi.fn().mockResolvedValue([
            {
              id: 99,
              content: 'Tìm vé khứ hồi từ Hồ Chí Minh đi Đà Lạt đi ngày 15/11/2026 về ngày 18/11/2026',
              role: 'USER',
            },
          ]),
        },
      } as unknown as PrismaService;

      const mockBusinessTools = {
        searchAvailableTrips: vi.fn().mockResolvedValue({
          summary: 'Tìm thấy 1 chuyến',
          allDayTotal: 1,
          trips: [
            {
              tripId: 101,
              operator: 'Phương Trang',
              origin: 'TP.HCM',
              destination: 'Đà Lạt',
              departureDate: '2026-11-15',
              departureTime: '06:00',
              vehicleType: 'GHẾ NGỒI',
              price: 180000,
              availableSeats: 28,
              bookingUrl: '/trips/101',
            },
          ],
        }),
      } as unknown as AiBusinessToolsService;

      const mockRetrieval = {
        retrieve: vi.fn().mockResolvedValue([]),
      } as any;

      const testOrchestrator = new AiChatbotOrchestratorService(
        new ConfigService({}),
        mockRetrieval,
        mockBusinessTools,
        mockPrisma,
      );

      // Người dùng gửi câu hỏi 1 chiều bình thường (không nhắc gì khứ hồi hay 2 chiều)
      const res = await testOrchestrator.processUserMessage({
        message: 'Tìm xe từ HCM đi Đà Lạt ngày 15/11/2026',
        sessionToken: '11111111-1111-4111-8111-111111111111',
      });

      // Mặc định CHỈ hiển thị 1 chiều, KHÔNG kế thừa lượt về
      expect(res.isRoundTrip).toBeFalsy();
      expect(res.suggestedReturnTrips).toBeUndefined();
      expect(res.roundTripBookingUrl).toBeUndefined();
      expect(res.suggestedTrips?.length).toBe(1);
      expect(mockBusinessTools.searchAvailableTrips).toHaveBeenCalledTimes(1);
    });
  });
});
