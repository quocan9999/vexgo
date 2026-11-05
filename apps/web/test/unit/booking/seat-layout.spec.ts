import { describe, expect, it } from 'vitest';
import { getTripSeatFloorLayouts } from '@/features/booking/utils/seat-layout';
import type { ApiTripSeat } from '@/features/trips/services/trips.api';

describe('seat-layout', () => {
  it('correctly maps 1-based grid coordinates to 2-column layout without overlapping', () => {
    // Simulated vehicle 408 seats (20 seats, col 1-2, row 1-10)
    const seats: ApiTripSeat[] = Array.from({ length: 20 }, (_, index) => {
      const seatNum = String(index + 1).padStart(2, '0');
      const col = (index % 2) + 1; // 1 or 2
      const row = Math.floor(index / 2) + 1; // 1 to 10
      return {
        tripSeatId: 1000 + index,
        seatNumber: `A${seatNum}`,
        position: col === 1 ? 'Dãy trái' : 'Dãy phải',
        floor: 1,
        x: col,
        y: row,
        status: 'TRONG',
      };
    });

    const layouts = getTripSeatFloorLayouts(seats);
    expect(layouts).toHaveLength(1);
    const floor = layouts[0];
    expect(floor.seats).toHaveLength(20);

    // Verify all 20 seats have distinct non-zero coordinates
    const uniquePositions = new Set(
      floor.seats.map((s) => `${s.leftPercent}%-${s.topPx}px`),
    );
    expect(uniquePositions.size).toBe(20);

    // Check A01 and A02
    const a01 = floor.seats.find((s) => s.seat.seatNumber === 'A01');
    const a02 = floor.seats.find((s) => s.seat.seatNumber === 'A02');
    expect(a01?.leftPercent).toBe(34); // col 1 in 2-column layout = 340 / 10 = 34%
    expect(a02?.leftPercent).toBe(66); // col 2 in 2-column layout = 660 / 10 = 66%
    expect(a01?.topPx).toBe(64); // row 1 = 1000 * (64 / 1000) = 64px
    expect(a02?.topPx).toBe(64);

    // Check A19 and A20
    const a19 = floor.seats.find((s) => s.seat.seatNumber === 'A19');
    const a20 = floor.seats.find((s) => s.seat.seatNumber === 'A20');
    expect(a19?.leftPercent).toBe(34);
    expect(a20?.leftPercent).toBe(66);
    expect(a19?.topPx).toBe(640); // row 10 = 10000 * (64 / 1000) = 640px
    expect(a20?.topPx).toBe(640);

    // Height should be large enough to contain all 10 rows
    expect(floor.heightPx).toBeGreaterThanOrEqual(768);
  });

  it('preserves permille coordinates directly for standard vehicles', () => {
    const seats: ApiTripSeat[] = [
      {
        tripSeatId: 1,
        seatNumber: '01',
        floor: 1,
        x: 180,
        y: 1000,
        position: null,
        status: 'TRONG',
      },
      {
        tripSeatId: 2,
        seatNumber: '02',
        floor: 1,
        x: 500,
        y: 1000,
        position: null,
        status: 'TRONG',
      },
      {
        tripSeatId: 3,
        seatNumber: '03',
        floor: 1,
        x: 820,
        y: 1000,
        position: null,
        status: 'TRONG',
      },
    ];

    const layouts = getTripSeatFloorLayouts(seats);
    expect(layouts[0].seats[0].leftPercent).toBe(18);
    expect(layouts[0].seats[0].topPx).toBe(64);
    expect(layouts[0].seats[1].leftPercent).toBe(50);
    expect(layouts[0].seats[2].leftPercent).toBe(82);
  });

  it('uses fallback grid when coordinates are null or undefined', () => {
    const seats: ApiTripSeat[] = [
      {
        tripSeatId: 1,
        seatNumber: 'A01',
        floor: 1,
        position: null,
        status: 'TRONG',
      },
      {
        tripSeatId: 2,
        seatNumber: 'A02',
        floor: 1,
        position: null,
        status: 'TRONG',
      },
    ];

    const layouts = getTripSeatFloorLayouts(seats);
    expect(layouts[0].seats).toHaveLength(2);
    expect(layouts[0].seats[0].leftPercent).toBe(16);
    expect(layouts[0].seats[1].leftPercent).toBe(36);
  });

  it('resolves collision if two seats have identical coordinates', () => {
    const seats: ApiTripSeat[] = [
      {
        tripSeatId: 1,
        seatNumber: 'A01',
        floor: 1,
        x: 180,
        y: 1000,
        position: null,
        status: 'TRONG',
      },
      {
        tripSeatId: 2,
        seatNumber: 'A02',
        floor: 1,
        x: 180,
        y: 1000, // duplicate!
        position: null,
        status: 'TRONG',
      },
    ];

    const layouts = getTripSeatFloorLayouts(seats);
    const [s1, s2] = layouts[0].seats;
    expect(s1.leftPercent !== s2.leftPercent || s1.topPx !== s2.topPx).toBe(
      true,
    );
  });

  it('does not falsely detect collision on tightly spaced 5-seat back row (gaps 140-170 permille)', () => {
    // Simulated back row of 45-seat bus from PR #65 (x: 180, 360, 500, 640, 820 with min gap 140)
    const seats: ApiTripSeat[] = [
      { tripSeatId: 41, seatNumber: 'A41', floor: 1, x: 180, y: 11000, position: 'Băng cuối', status: 'TRONG' },
      { tripSeatId: 42, seatNumber: 'A42', floor: 1, x: 360, y: 11000, position: 'Băng cuối', status: 'TRONG' },
      { tripSeatId: 43, seatNumber: 'A43', floor: 1, x: 500, y: 11000, position: 'Băng cuối', status: 'TRONG' },
      { tripSeatId: 44, seatNumber: 'A44', floor: 1, x: 640, y: 11000, position: 'Băng cuối', status: 'TRONG' },
      { tripSeatId: 45, seatNumber: 'A45', floor: 1, x: 820, y: 11000, position: 'Băng cuối', status: 'TRONG' },
    ];

    const layouts = getTripSeatFloorLayouts(seats);
    const floor = layouts[0];
    expect(floor.seats).toHaveLength(5);

    // All 5 seats must stay on row y=11000 (topPx = 11000 * 0.064 = 704px) without being kicked up
    floor.seats.forEach((s) => {
      expect(s.topPx).toBe(704);
    });

    const a43 = floor.seats.find((s) => s.seat.seatNumber === 'A43');
    expect(a43?.leftPercent).toBe(50);
  });
});
