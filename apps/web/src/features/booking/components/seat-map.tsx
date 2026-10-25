/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { tripsApi, type ApiTripSeat } from '@/features/trips/services/trips.api';
import { getTripSeatFloorLayouts } from '../utils/seat-layout';

const SeatSVG = ({
  id,
  status,
  onClick,
  style,
}: {
  id: string;
  status: 'available' | 'sold' | 'selected';
  onClick: () => void;
  style?: React.CSSProperties;
}) => {
  const colors = {
    sold: { fill: '#e2e5e7', stroke: '#cbd5e1', text: '#94a3b8' },
    available: { fill: '#e0f2fe', stroke: '#7dd3fc', text: '#38bdf8' },
    selected: { fill: '#ffedd5', stroke: '#fdba74', text: '#f97316' },
  }[status];
  
  return (
    <svg
      onClick={onClick}
      width="36"
      height="44"
      viewBox="0 0 32 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute -translate-x-1/2 -translate-y-1/2 ${status !== 'sold' ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-not-allowed'}`}
      style={style}
    >
      <path d="M8 4C8 1.79086 9.79086 0 12 0H20C22.2091 0 24 1.79086 24 4V8H8V4Z" fill={colors.fill} stroke={colors.stroke} />
      <path d="M0 16C0 13.7909 1.79086 12 4 12V28C1.79086 28 0 26.2091 0 24V16Z" fill={colors.fill} stroke={colors.stroke} />
      <path d="M32 16C32 13.7909 30.2091 12 28 12V28C30.2091 28 32 26.2091 32 24V16Z" fill={colors.fill} stroke={colors.stroke} />
      <rect x="4" y="6" width="24" height="30" rx="4" fill={colors.fill} stroke={colors.stroke} />
      <text x="16" y="22" textAnchor="middle" alignmentBaseline="middle" fill={colors.text} fontSize="11" fontWeight="bold" fontFamily="sans-serif">{id}</text>
    </svg>
  );
};

const SAMPLE_SEAT_ROWS = [
  ['A01', null, 'A02'],
  ['A03', 'A04', 'A05'],
  ['A06', 'A07', 'A08'],
  ['A09', 'A10', 'A11'],
  ['A12', 'A13', 'A14'],
  ['A15', 'A16', 'A17'],
  ['B01', null, 'B02'],
  ['B03', 'B04', 'B05'],
  ['B06', 'B07', 'B08'],
  ['B09', 'B10', 'B11'],
  ['B12', 'B13', 'B14'],
  ['B15', 'B16', 'B17'],
] as const;

const SAMPLE_SEATS: ApiTripSeat[] = SAMPLE_SEAT_ROWS.flatMap((row, rowIndex) =>
  row.flatMap((seatNumber, columnIndex) =>
    seatNumber
      ? [
          {
            tripSeatId: rowIndex * 3 + columnIndex + 1,
            seatNumber,
            position: null,
            floor: rowIndex < 6 ? 1 : 2,
            x: [180, 500, 820][columnIndex],
            y: 1000 + (rowIndex % 6) * 1000,
            status: 'TRONG',
          },
        ]
      : [],
  ),
);

export const SeatMap = ({ tripId }: { tripId?: number }) => {
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [seats, setSeats] = useState<ApiTripSeat[]>([]);
  const [loading, setLoading] = useState(Boolean(tripId));

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    tripsApi.getTripSeats(tripId)
      .then(data => setSeats(data))
      .catch(err => console.warn('Failed to load seats', err))
      .finally(() => setLoading(false));
  }, [tripId]);

  const displayedSeats = tripId ? seats : SAMPLE_SEATS;
  const seatFloorLayouts = getTripSeatFloorLayouts(displayedSeats);
  const soldSeats = tripId
    ? seats.filter((seat) => seat.status !== 'TRONG').map((seat) => seat.seatNumber)
    : ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A08', 'B01', 'B02'];

  const toggleSeat = (id: string) => {
    if (soldSeats.includes(id)) return;
    setSelectedSeats(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const getStatus = (id: string) => {
    if (soldSeats.includes(id)) return 'sold';
    if (selectedSeats.includes(id)) return 'selected';
    return 'available';
  };

  const renderFloor = (layout: (typeof seatFloorLayouts)[number]) => (
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-semibold mb-4">{layout.label}</h3>
      <div
        className="relative w-[220px] max-w-full"
        style={{ height: `${layout.heightPx}px` }}
      >
        {layout.seats.map(({ seat, leftPercent, topPx }) => (
          <SeatSVG
            key={seat.tripSeatId}
            id={seat.seatNumber}
            status={getStatus(seat.seatNumber)}
            onClick={() => toggleSeat(seat.seatNumber)}
            style={{ left: `${leftPercent}%`, top: `${topPx}px` }}
          />
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center pb-4 text-sm text-slate-500">
        Đang tải sơ đồ ghế...
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center pb-4">
      <div className="flex gap-8 mb-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#e2e5e7] border border-[#cbd5e1]"></div>
          <span>Đã bán</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#e0f2fe] border border-[#7dd3fc]"></div>
          <span>Còn trống</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[#ffedd5] border border-[#fdba74]"></div>
          <span>Đang chọn</span>
        </div>
      </div>
      
      {seatFloorLayouts.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-8 md:gap-16">
          {seatFloorLayouts.map((layout) => (
            <div key={layout.floor}>{renderFloor(layout)}</div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">Chưa có sơ đồ ghế cho chuyến này.</p>
      )}
    </div>
  );
};
