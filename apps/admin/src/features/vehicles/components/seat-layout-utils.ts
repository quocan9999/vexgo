import type { VehicleSeat, VehicleSeatLayoutInput } from '../types/vehicle';

export type SeatLayoutItem = VehicleSeatLayoutInput & { seatId?: number };

export const MAX_VEHICLE_SEATS = 120;

const MIN_SEAT_GAP_X = 180;
const MIN_SEAT_GAP_Y = 875;

const COLUMN_POSITIONS: Record<number, readonly number[]> = {
  1: [500],
  2: [340, 660],
  3: [180, 500, 820],
  4: [160, 360, 640, 840],
  5: [110, 305, 500, 695, 890],
};

function positionsOverlap(
  left: Pick<SeatLayoutItem, 'floor' | 'x' | 'y'>,
  right: Pick<SeatLayoutItem, 'floor' | 'x' | 'y'>,
) {
  return (
    left.floor === right.floor &&
    Math.abs(left.x - right.x) < MIN_SEAT_GAP_X &&
    Math.abs(left.y - right.y) < MIN_SEAT_GAP_Y
  );
}

function legacyFloor(seat: Pick<VehicleSeat, 'seatNumber' | 'position'>) {
  return seat.position?.toLocaleLowerCase('vi-VN').includes('trên') ||
    seat.seatNumber.toLocaleUpperCase('vi-VN').startsWith('B')
    ? 2
    : 1;
}

export function findNextSeatCoordinates(
  seats: readonly SeatLayoutItem[],
  floor: number,
  columnCount = 4,
) {
  const columns = COLUMN_POSITIONS[columnCount] ?? COLUMN_POSITIONS[4];
  for (let row = 0; row < 30; row += 1) {
    const y = 1000 + row * 1000;
    for (const x of columns) {
      const occupied = seats.some((seat) =>
        positionsOverlap({ floor, x, y }, seat),
      );
      if (!occupied) return { x, y };
    }
  }
  return null;
}

export function inferSeatColumnCount(
  seats: readonly SeatLayoutItem[],
  floor: number,
) {
  const count = countSeatColumns(seats, floor);
  return count > 0 ? Math.min(5, count) : 4;
}

export function countSeatColumns(
  seats: readonly SeatLayoutItem[],
  floor: number,
) {
  const positions = seats
    .filter((seat) => seat.floor === floor)
    .map((seat) => seat.x)
    .sort((left, right) => left - right);
  let count = 0;
  let lastPosition: number | undefined;
  for (const position of positions) {
    if (lastPosition === undefined || position - lastPosition > 90) {
      count += 1;
      lastPosition = position;
    }
  }
  return count;
}

export function reflowSeatsForColumnCount(
  seats: readonly SeatLayoutItem[],
  floor: number,
  columnCount: number,
) {
  const columns = COLUMN_POSITIONS[columnCount] ?? COLUMN_POSITIONS[4];
  const floorSeats = seats
    .filter((seat) => seat.floor === floor)
    .sort(
      (left, right) =>
        left.y - right.y ||
        left.x - right.x ||
        left.seatNumber.localeCompare(right.seatNumber, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
    );
  const positions = new Map(
    floorSeats.map((seat, index) => [
      seat.seatNumber,
      {
        x: columns[index % columns.length],
        y: 1000 + Math.floor(index / columns.length) * 1000,
      },
    ]),
  );
  return seats.map((seat) => {
    const position = positions.get(seat.seatNumber);
    return position ? { ...seat, ...position } : seat;
  });
}

export function compactSeatNumbersAfterRemoval(
  seats: readonly SeatLayoutItem[],
  seatNumber: string,
) {
  const removedSeat = seats.find((seat) => seat.seatNumber === seatNumber);
  const remaining = seats.filter((seat) => seat.seatNumber !== seatNumber);
  const match = removedSeat?.seatNumber.match(/^([a-z]+)(\d+)$/i);
  if (!removedSeat || !match) return remaining;

  const [, prefix, suffix] = match;
  const removedNumber = Number(suffix);
  const prefixPattern = new RegExp(`^${prefix}\\d+$`, 'i');
  const numberWidth = Math.max(
    2,
    ...seats
      .filter(
        (seat) =>
          seat.floor === removedSeat.floor &&
          prefixPattern.test(seat.seatNumber),
      )
      .map((seat) => seat.seatNumber.match(/\d+$/)?.[0].length ?? 0),
  );
  return remaining.map((seat) => {
    if (
      seat.floor !== removedSeat.floor ||
      !prefixPattern.test(seat.seatNumber)
    ) {
      return seat;
    }
    const seatSuffix = seat.seatNumber.match(/\d+$/)?.[0];
    const currentNumber = Number(seatSuffix ?? 0);
    if (currentNumber <= removedNumber) return seat;
    return {
      ...seat,
      seatNumber: `${prefix}${String(currentNumber - 1).padStart(
        Math.max(numberWidth, seatSuffix?.length ?? 0),
        '0',
      )}`,
    };
  });
}

export function nextSeatNumber(
  seats: readonly SeatLayoutItem[],
  floor: number,
) {
  const prefix = floor === 2 ? 'B' : 'A';
  const used = new Set(
    seats.map((seat) => seat.seatNumber.toLocaleUpperCase('vi-VN')),
  );
  for (let number = 1; number <= MAX_VEHICLE_SEATS; number += 1) {
    const seatNumber = `${prefix}${String(number).padStart(2, '0')}`;
    if (!used.has(seatNumber)) return seatNumber;
  }
  return null;
}

export function normalizeVehicleSeatLayout(seats: readonly VehicleSeat[]) {
  const normalized = [...seats]
    .sort((a, b) =>
      a.seatNumber.localeCompare(b.seatNumber, undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    )
    .map((seat) => ({
      seatId: seat.seatId,
      seatNumber: seat.seatNumber,
      position: seat.position,
      floor:
        seat.floor === 1 || seat.floor === 2 ? seat.floor : legacyFloor(seat),
      x: seat.x ?? Number.NaN,
      y: seat.y ?? Number.NaN,
    })) satisfies SeatLayoutItem[];

  const positioned = normalized.filter(
    (seat) => Number.isSafeInteger(seat.x) && Number.isSafeInteger(seat.y),
  );
  for (const seat of normalized) {
    if (Number.isSafeInteger(seat.x) && Number.isSafeInteger(seat.y)) continue;
    const coordinates = findNextSeatCoordinates(positioned, seat.floor);
    if (!coordinates) continue;
    seat.x = coordinates.x;
    seat.y = coordinates.y;
    positioned.push(seat);
  }
  return normalized;
}

export function toVehicleSeatLayoutUpdate(seats: readonly SeatLayoutItem[]) {
  return seats.flatMap((seat) =>
    seat.seatId === undefined
      ? []
      : [{ seatId: seat.seatId, floor: seat.floor, x: seat.x, y: seat.y }],
  );
}
