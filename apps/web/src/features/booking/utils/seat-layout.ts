import type { ApiTripSeat } from '@/features/trips/services/trips.api';

const COORDINATE_UNIT_PX = 64 / 1000;
const FALLBACK_X_COORDINATES = [160, 360, 640, 840] as const;
const FALLBACK_ROW_STEP = 1000;
const FALLBACK_MIN_X_GAP = 180;
const FALLBACK_MIN_Y_GAP = 875;

export type PositionedTripSeat = {
  seat: ApiTripSeat;
  leftPercent: number;
  topPx: number;
};

export type TripSeatFloorLayout = {
  floor: number;
  label: string;
  heightPx: number;
  seats: PositionedTripSeat[];
};

function getSeatFloor(seat: ApiTripSeat): number {
  if (
    typeof seat.floor === 'number' &&
    Number.isInteger(seat.floor) &&
    seat.floor > 0
  ) {
    return seat.floor;
  }

  const seatNumber = seat.seatNumber.toLocaleUpperCase('vi-VN');
  const position = seat.position?.toLocaleLowerCase('vi-VN') ?? '';
  return seatNumber.startsWith('B') || position.includes('trên') ? 2 : 1;
}

function hasCoordinates(seat: ApiTripSeat): seat is ApiTripSeat & {
  x: number;
  y: number;
} {
  return (
    typeof seat.x === 'number' &&
    Number.isFinite(seat.x) &&
    typeof seat.y === 'number' &&
    Number.isFinite(seat.y)
  );
}

function findFallbackCoordinates(
  occupied: Array<{ x: number; y: number }>,
  seatIndex: number,
) {
  for (let row = 0; row < 30; row += 1) {
    const y = FALLBACK_ROW_STEP + row * FALLBACK_ROW_STEP;
    for (const x of FALLBACK_X_COORDINATES) {
      const overlaps = occupied.some(
        (position) =>
          Math.abs(position.x - x) < FALLBACK_MIN_X_GAP &&
          Math.abs(position.y - y) < FALLBACK_MIN_Y_GAP,
      );
      if (!overlaps) return { x, y };
    }
  }

  return {
    x: FALLBACK_X_COORDINATES[seatIndex % FALLBACK_X_COORDINATES.length],
    y:
      FALLBACK_ROW_STEP *
      (Math.floor(seatIndex / FALLBACK_X_COORDINATES.length) + 1),
  };
}

export function getTripSeatFloorLayouts(
  seats: readonly ApiTripSeat[],
): TripSeatFloorLayout[] {
  const groupedSeats = new Map<number, ApiTripSeat[]>();
  seats.forEach((seat) => {
    const floor = getSeatFloor(seat);
    const floorSeats = groupedSeats.get(floor) ?? [];
    floorSeats.push(seat);
    groupedSeats.set(floor, floorSeats);
  });

  return [...groupedSeats.entries()]
    .sort(([left], [right]) => left - right)
    .map(([floor, floorSeats]) => {
      const bySeatNumber = [...floorSeats].sort((left, right) =>
        left.seatNumber.localeCompare(right.seatNumber, undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      );
      const occupied = bySeatNumber
        .filter(hasCoordinates)
        .map((seat) => ({ x: seat.x, y: seat.y }));
      const positionedSeats = bySeatNumber.map((seat, index) => {
        const coordinates = hasCoordinates(seat)
          ? { x: seat.x, y: seat.y }
          : findFallbackCoordinates(occupied, index);
        occupied.push(coordinates);

        return {
          seat,
          leftPercent: coordinates.x / 10,
          topPx: coordinates.y * COORDINATE_UNIT_PX,
          y: coordinates.y,
          x: coordinates.x,
        };
      });

      positionedSeats.sort(
        (left, right) =>
          left.y - right.y ||
          left.x - right.x ||
          left.seat.seatNumber.localeCompare(right.seat.seatNumber, undefined, {
            numeric: true,
            sensitivity: 'base',
          }),
      );

      const maxY = Math.max(
        FALLBACK_ROW_STEP,
        ...positionedSeats.map((seat) => seat.y),
      );

      return {
        floor,
        label:
          floor === 1 ? 'Tầng dưới' : floor === 2 ? 'Tầng trên' : `Tầng ${floor}`,
        heightPx: Math.max(
          192,
          (Math.floor(maxY / FALLBACK_ROW_STEP) + 2) * 64,
        ),
        seats: positionedSeats,
      };
    });
}
