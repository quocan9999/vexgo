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
  });

  describe('AiBusinessToolsService.searchAvailableTrips', () => {
    it('7. should expand location synonyms (Sài Gòn / Hồ Chí Minh -> TP.HCM, Lâm Đồng -> Đà Lạt)', async () => {
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
  });
});
