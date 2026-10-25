'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  Armchair,
  BusFront,
  LoaderCircle,
  PencilLine,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  ResourceConfirmation,
  ResourceNotice,
} from '@/components/admin/resource-ui';
import { Button } from '@/components/ui/action-button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { VehicleSeat } from '../types/vehicle';
import {
  findNextSeatCoordinates,
  inferSeatColumnCount,
  MAX_VEHICLE_SEATS,
  nextSeatNumber,
  reflowSeatsForColumnCount,
  type SeatLayoutItem,
} from './seat-layout-utils';

type SeatLayoutEditorProps = {
  seats: SeatLayoutItem[];
  disabled?: boolean;
  canAdd?: boolean;
  canRemoveDraft?: boolean;
  canEditSelected?: boolean;
  canDeleteSelected?: boolean;
  deletingSeat?: boolean;
  saving?: boolean;
  dirty?: boolean;
  error?: string | null;
  onChange: (seats: SeatLayoutItem[]) => void;
  onAddSeat?: (seat: SeatLayoutItem) => Promise<VehicleSeat | SeatLayoutItem>;
  onRemoveSeat?: (seatNumber: string) => void;
  onRequestEditSeat?: (seat: SeatLayoutItem) => void;
  onRequestDeleteSeat?: (seat: SeatLayoutItem) => void;
  onDeleteUpperFloor?: () => Promise<void>;
  onSave?: () => void;
};

type DragState = {
  pointerId: number;
  seatNumber: string;
  floor: number;
  startX: number;
  startY: number;
  pointerX: number;
  pointerY: number;
};

type AlignmentGuides = { x: number | null; y: number | null };

const VERTICAL_UNIT_PX = 0.064;

export function SeatLayoutEditor({
  seats,
  disabled = false,
  canAdd = true,
  canRemoveDraft = false,
  canEditSelected = false,
  canDeleteSelected = false,
  deletingSeat = false,
  saving = false,
  dirty = false,
  error,
  onChange,
  onAddSeat,
  onRemoveSeat,
  onRequestEditSeat,
  onRequestDeleteSeat,
  onDeleteUpperFloor,
  onSave,
}: SeatLayoutEditorProps) {
  const [activeFloor, setActiveFloor] = useState(1);
  const [hasSecondFloor, setHasSecondFloor] = useState(false);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState<string | null>(
    null,
  );
  const [adding, setAdding] = useState(false);
  const [floorRemovalOpen, setFloorRemovalOpen] = useState(false);
  const [floorRemoving, setFloorRemoving] = useState(false);
  const [floorRemovalError, setFloorRemovalError] = useState<string | null>(
    null,
  );
  const [interactionMessage, setInteractionMessage] = useState<string | null>(
    null,
  );
  const [columnCounts, setColumnCounts] = useState<Record<number, number>>(
    () => ({
      1: inferSeatColumnCount(seats, 1),
      2: inferSeatColumnCount(seats, 2),
    }),
  );
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuides>({
    x: null,
    y: null,
  });
  const dragRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const hasFloorTwo = hasSecondFloor || seats.some((seat) => seat.floor === 2);
  const activeVisibleFloor = hasFloorTwo ? activeFloor : 1;
  const upperFloorSeats = seats.filter((seat) => seat.floor === 2);
  const selectedSeat = seats.find(
    (seat) => seat.seatNumber === selectedSeatNumber,
  );
  const busy = disabled || saving || adding || floorRemoving;

  function updateGroup(
    group: readonly string[],
    floor: number,
    axis: 'x' | 'y',
    value: number,
  ) {
    const groupNumbers = new Set(group);
    const nextSeats = seats.map((seat) =>
      groupNumbers.has(seat.seatNumber) ? { ...seat, [axis]: value } : seat,
    );
    const moved = nextSeats.filter((seat) => groupNumbers.has(seat.seatNumber));
    const movedNumbers = new Set(moved.map((seat) => seat.seatNumber));
    const collides = moved.some((seat) =>
      nextSeats.some(
        (other) =>
          other.floor === floor &&
          !movedNumbers.has(other.seatNumber) &&
          Math.abs(other.x - seat.x) < 180 &&
          Math.abs(other.y - seat.y) < 875,
      ),
    );
    if (collides) {
      setInteractionMessage('Khoảng cách này làm hai ghế bị chồng lên nhau.');
      return;
    }
    setInteractionMessage(null);
    onChange(nextSeats);
  }

  function nudgeSeat(seatNumber: string, axis: 'x' | 'y', delta: number) {
    const seat = seats.find((item) => item.seatNumber === seatNumber);
    if (!seat || busy) return;
    const group = seats
      .filter(
        (item) =>
          item.floor === seat.floor &&
          (axis === 'x' ? item.x === seat.x : item.y === seat.y),
      )
      .map((item) => item.seatNumber);
    const limit = axis === 'x' ? 890 : 30000;
    const minimum = axis === 'x' ? 110 : 1000;
    const step = axis === 'x' ? 5 : 50;
    const value = Math.max(
      minimum,
      Math.min(limit, Math.round((seat[axis] + delta) / step) * step),
    );
    updateGroup(group, seat.floor, axis, value);
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    seat: SeatLayoutItem,
  ) {
    if (busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedSeatNumber(seat.seatNumber);
    setInteractionMessage(null);
    setAlignmentGuides({ x: null, y: null });
    dragRef.current = {
      pointerId: event.pointerId,
      seatNumber: seat.seatNumber,
      floor: seat.floor,
      startX: seat.x,
      startY: seat.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || busy) return;
    const deltaX = event.clientX - drag.pointerX;
    const deltaY = event.clientY - drag.pointerY;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 3) return;

    const width = Math.max(
      1,
      canvasRef.current?.getBoundingClientRect().width ?? 1,
    );
    const rawX = Math.max(
      110,
      Math.min(
        890,
        Math.round((drag.startX + (deltaX / width) * 1000) / 5) * 5,
      ),
    );
    const rawY = Math.max(
      1000,
      Math.min(
        30000,
        Math.round((drag.startY + deltaY / VERTICAL_UNIT_PX) / 50) * 50,
      ),
    );
    const otherSeats = seats.filter(
      (seat) =>
        seat.floor === drag.floor && seat.seatNumber !== drag.seatNumber,
    );
    const xSnapDistance = (10 / width) * 1000;
    const ySnapDistance = 10 / VERTICAL_UNIT_PX;
    const nearestX = otherSeats
      .map((seat) => seat.x)
      .filter((x) => Math.abs(x - rawX) <= xSnapDistance)
      .sort((left, right) => Math.abs(left - rawX) - Math.abs(right - rawX))[0];
    const nearestY = otherSeats
      .map((seat) => seat.y)
      .filter((y) => Math.abs(y - rawY) <= ySnapDistance)
      .sort((left, right) => Math.abs(left - rawY) - Math.abs(right - rawY))[0];

    const candidates = [
      {
        x: nearestX ?? rawX,
        y: nearestY ?? rawY,
        guideX: nearestX ?? null,
        guideY: nearestY ?? null,
      },
      { x: nearestX ?? rawX, y: rawY, guideX: nearestX ?? null, guideY: null },
      { x: rawX, y: nearestY ?? rawY, guideX: null, guideY: nearestY ?? null },
      { x: rawX, y: rawY, guideX: null, guideY: null },
    ].filter(
      (candidate, index, all) =>
        all.findIndex(
          (item) => item.x === candidate.x && item.y === candidate.y,
        ) === index,
    );
    const destination = candidates.find(
      (candidate) =>
        !otherSeats.some(
          (seat) =>
            Math.abs(seat.x - candidate.x) < 180 &&
            Math.abs(seat.y - candidate.y) < 875,
        ),
    );

    if (!destination) {
      setAlignmentGuides({ x: null, y: null });
      setInteractionMessage('Khoảng cách này làm hai ghế bị chồng lên nhau.');
      return;
    }

    setInteractionMessage(null);
    setAlignmentGuides({ x: destination.guideX, y: destination.guideY });
    onChange(
      seats.map((seat) =>
        seat.seatNumber === drag.seatNumber
          ? { ...seat, x: destination.x, y: destination.y }
          : seat,
      ),
    );
  }

  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setAlignmentGuides({ x: null, y: null });
  }

  function changeColumnCount(value: string | null) {
    if (value === null) return;
    const columnCount = Number(value);
    if (!Number.isInteger(columnCount) || columnCount < 1 || columnCount > 5)
      return;
    setColumnCounts((current) => ({
      ...current,
      [activeVisibleFloor]: columnCount,
    }));
    setInteractionMessage(null);
    const nextSeats = reflowSeatsForColumnCount(
      seats,
      activeVisibleFloor,
      columnCount,
    );
    const positionsChanged = nextSeats.some(
      (seat, index) => seat.x !== seats[index]?.x || seat.y !== seats[index]?.y,
    );
    if (positionsChanged) onChange(nextSeats);
  }

  function handleSeatKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    seat: SeatLayoutItem,
  ) {
    const step = event.shiftKey ? 100 : 20;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      nudgeSeat(seat.seatNumber, 'x', event.key === 'ArrowLeft' ? -step : step);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      nudgeSeat(
        seat.seatNumber,
        'y',
        event.key === 'ArrowUp' ? -step * 10 : step * 10,
      );
    }
  }

  async function addSeat() {
    if (busy || !canAdd || seats.length >= MAX_VEHICLE_SEATS) return;
    const seatNumber = nextSeatNumber(seats, activeVisibleFloor);
    const coordinates = findNextSeatCoordinates(
      seats,
      activeVisibleFloor,
      columnCounts[activeVisibleFloor] ?? 4,
    );
    if (!seatNumber || !coordinates) {
      setInteractionMessage('Tầng này đã đạt số ghế tối đa.');
      return;
    }
    const nextSeat: SeatLayoutItem = {
      seatNumber,
      position: null,
      floor: activeVisibleFloor,
      ...coordinates,
    };
    setAdding(true);
    setInteractionMessage(null);
    try {
      const savedSeat = onAddSeat ? await onAddSeat(nextSeat) : nextSeat;
      const savedLayoutSeat: SeatLayoutItem = {
        seatId: 'seatId' in savedSeat ? savedSeat.seatId : undefined,
        seatNumber: savedSeat.seatNumber,
        position: savedSeat.position,
        floor: savedSeat.floor,
        x: savedSeat.x ?? nextSeat.x,
        y: savedSeat.y ?? nextSeat.y,
      };
      onChange([...seats, savedLayoutSeat]);
      setSelectedSeatNumber(savedLayoutSeat.seatNumber);
    } catch (addError: unknown) {
      setInteractionMessage(
        addError instanceof Error ? addError.message : 'Không thể thêm ghế.',
      );
    } finally {
      setAdding(false);
    }
  }

  function requestDeleteSelectedSeat() {
    if (!selectedSeat || saving || adding || deletingSeat || dirty) return;
    if (canRemoveDraft && onRemoveSeat && selectedSeat.seatId === undefined) {
      onRemoveSeat(selectedSeat.seatNumber);
      setSelectedSeatNumber(null);
      return;
    }
    if (canDeleteSelected && selectedSeat.seatId !== undefined) {
      onRequestDeleteSeat?.(selectedSeat);
      setSelectedSeatNumber(null);
    }
  }

  function removeEmptyUpperFloor() {
    setHasSecondFloor(false);
    setActiveFloor(1);
    setSelectedSeatNumber(null);
    setFloorRemovalOpen(false);
    setFloorRemovalError(null);
    setInteractionMessage(null);
  }

  function requestRemoveUpperFloor() {
    if (!hasFloorTwo || saving || adding || floorRemoving) return;
    if (upperFloorSeats.length === 0) {
      removeEmptyUpperFloor();
      return;
    }
    if (dirty) {
      setInteractionMessage('Lưu sơ đồ hiện tại trước khi xóa tầng trên.');
      return;
    }
    if (!canRemoveDraft && !onDeleteUpperFloor) return;
    setFloorRemovalError(null);
    setInteractionMessage(null);
    setFloorRemovalOpen(true);
  }

  async function confirmRemoveUpperFloor() {
    if (floorRemoving) return;
    setFloorRemovalError(null);
    if (canRemoveDraft) {
      onChange(seats.filter((seat) => seat.floor !== 2));
      removeEmptyUpperFloor();
      return;
    }
    if (!onDeleteUpperFloor) return;
    setFloorRemoving(true);
    try {
      await onDeleteUpperFloor();
      removeEmptyUpperFloor();
    } catch (error: unknown) {
      setFloorRemovalError(
        error instanceof Error ? error.message : 'Không thể xóa tầng trên.',
      );
    } finally {
      setFloorRemoving(false);
    }
  }

  function renderFloorContent(floor: number) {
    const seatsOnFloor = seats.filter((seat) => seat.floor === floor);
    const floorMaxY = Math.max(1000, ...seatsOnFloor.map((seat) => seat.y));
    const height = Math.max(500, (Math.floor(floorMaxY / 1000) + 2) * 64);

    return (
      <div
        aria-label={`Sơ đồ ghế tầng ${floor === 1 ? 'dưới' : 'trên'}`}
        className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-b-[28px] border-x border-b border-border bg-muted/20"
        onPointerCancel={stopDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        ref={floor === activeVisibleFloor ? canvasRef : undefined}
        role="group"
        style={{ height }}
      >
        {alignmentGuides.x !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 z-0 border-l-2 border-dashed border-primary/70"
            style={{ left: `${alignmentGuides.x / 10}%` }}
          />
        )}
        {alignmentGuides.y !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 z-0 border-t-2 border-dashed border-primary/70"
            style={{ top: `${alignmentGuides.y * VERTICAL_UNIT_PX}px` }}
          />
        )}
        {seatsOnFloor.length === 0 ? (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-muted-foreground">
            Chưa có ghế ở tầng này. Dùng nút “Thêm ghế” để bắt đầu sơ đồ.
          </div>
        ) : (
          seatsOnFloor.map((seat) => {
            const selected = selectedSeatNumber === seat.seatNumber;
            return (
              <Button
                aria-label={`${seat.seatNumber}, tầng ${floor === 1 ? 'dưới' : 'trên'}. Dùng phím mũi tên để căn chỉnh theo hàng hoặc cột.`}
                aria-pressed={selected}
                className={`absolute z-10 h-14 w-[58px] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-xl px-1 shadow-sm ${busy ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                key={seat.seatNumber}
                onClick={() => setSelectedSeatNumber(seat.seatNumber)}
                onKeyDown={(event) => handleSeatKeyDown(event, seat)}
                onPointerDown={(event) => startDrag(event, seat)}
                style={{
                  left: `${seat.x / 10}%`,
                  top: `${seat.y * VERTICAL_UNIT_PX}px`,
                  touchAction: 'none',
                }}
                type="button"
                variant={selected ? 'default' : 'outline'}
              >
                <Armchair aria-hidden size={17} />
                <span className="max-w-full truncate font-mono text-[10px] font-semibold">
                  {seat.seatNumber}
                </span>
              </Button>
            );
          })
        )}
      </div>
    );
  }

  return (
    <>
      <Tabs
        className="gap-3"
        onValueChange={(value) => {
          setActiveFloor(value === '2' ? 2 : 1);
          setAlignmentGuides({ x: null, y: null });
        }}
        value={String(activeVisibleFloor)}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList
            aria-label="Tầng xe"
            className={`grid ${hasFloorTwo ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <TabsTrigger value="1">
              {hasFloorTwo ? 'Tầng dưới' : 'Ghế ngồi'}
            </TabsTrigger>
            {hasFloorTwo && <TabsTrigger value="2">Tầng trên</TabsTrigger>}
          </TabsList>
          {hasFloorTwo ? (
            <Button
              disabled={
                saving ||
                adding ||
                floorRemoving ||
                (upperFloorSeats.length > 0 &&
                  (dirty || (!canRemoveDraft && !onDeleteUpperFloor)))
              }
              onClick={requestRemoveUpperFloor}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 aria-hidden />
              Xóa tầng trên
            </Button>
          ) : (
            <Button
              disabled={busy}
              onClick={() => {
                setHasSecondFloor(true);
                setActiveFloor(2);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus aria-hidden />
              Tạo tầng trên
            </Button>
          )}
        </div>

        <Card className="h-auto gap-0 py-0">
          <CardHeader className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">Sơ đồ ghế 2D</CardTitle>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="text-sm font-medium text-muted-foreground"
                  id={`seat-column-count-${activeVisibleFloor}`}
                >
                  Số cột
                </span>
                <Select
                  disabled={busy}
                  onValueChange={changeColumnCount}
                  value={String(columnCounts[activeVisibleFloor] ?? 4)}
                >
                  <SelectTrigger
                    aria-labelledby={`seat-column-count-${activeVisibleFloor}`}
                    className="w-[76px]"
                    size="sm"
                  >
                    <SelectValue>
                      {columnCounts[activeVisibleFloor] ?? 4} cột
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {[1, 2, 3, 4, 5].map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} cột
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSeat &&
                canEditSelected &&
                onRequestEditSeat &&
                selectedSeat.seatId !== undefined && (
                  <Button
                    disabled={saving || adding || dirty}
                    onClick={() => onRequestEditSeat(selectedSeat)}
                    variant="outline"
                  >
                    <PencilLine aria-hidden />
                    Chỉnh sửa ghế đang chọn
                  </Button>
                )}
              <Button
                disabled={busy || !canAdd || seats.length >= MAX_VEHICLE_SEATS}
                onClick={() => void addSeat()}
                variant="outline"
              >
                <Plus aria-hidden />
                {adding ? 'Đang thêm…' : 'Thêm ghế'}
              </Button>
              {selectedSeat &&
                ((canRemoveDraft &&
                  onRemoveSeat &&
                  selectedSeat.seatId === undefined) ||
                  (canDeleteSelected &&
                    onRequestDeleteSeat &&
                    selectedSeat.seatId !== undefined)) && (
                  <Button
                    aria-busy={deletingSeat}
                    disabled={saving || adding || deletingSeat || dirty}
                    onClick={requestDeleteSelectedSeat}
                    variant="destructive"
                  >
                    {deletingSeat ? (
                      <LoaderCircle
                        aria-hidden
                        className="motion-safe:animate-spin"
                      />
                    ) : (
                      <Trash2 aria-hidden />
                    )}
                    {deletingSeat ? 'Đang xóa…' : 'Xóa ghế đang chọn'}
                  </Button>
                )}
              {onSave && (
                <Button
                  aria-busy={saving}
                  disabled={busy || !dirty || seats.length === 0}
                  onClick={onSave}
                >
                  {saving ? 'Đang lưu…' : 'Lưu sơ đồ'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="mx-auto flex w-full max-w-[460px] items-center justify-between rounded-t-[28px] border border-border bg-card px-4 py-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <BusFront aria-hidden className="text-primary" size={18} />
                Tài xế
              </span>
              <span>Đầu xe</span>
              <span>Cửa lên</span>
            </div>

            <TabsContent className="mt-0" value="1">
              {renderFloorContent(1)}
            </TabsContent>
            {hasFloorTwo && (
              <TabsContent className="mt-0" value="2">
                {renderFloorContent(2)}
              </TabsContent>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <p className="m-0">
                {seats.length.toLocaleString('vi-VN')} / {MAX_VEHICLE_SEATS} ghế
                · Kéo ghế để tạo khoảng cách lối đi.
              </p>
            </div>
            {(error || interactionMessage) && (
              <p className="m-0 text-sm text-destructive" role="alert">
                {error ?? interactionMessage}
              </p>
            )}
          </CardContent>
        </Card>
      </Tabs>

      {floorRemovalOpen && (
        <ResourceConfirmation
          busy={floorRemoving}
          description={
            canRemoveDraft
              ? `Xóa tầng trên sẽ bỏ ${upperFloorSeats.length} ghế khỏi bản nháp xe.`
              : `Xóa tầng trên sẽ xóa ${upperFloorSeats.length} ghế khỏi xe. Chỉ thực hiện được khi các ghế này chưa được dùng trong chuyến.`
          }
          onClose={() => {
            if (!floorRemoving) setFloorRemovalOpen(false);
          }}
          title="Xóa tầng trên?"
        >
          {floorRemovalError && (
            <ResourceNotice kind="error">{floorRemovalError}</ResourceNotice>
          )}
          <Button
            aria-busy={floorRemoving}
            disabled={floorRemoving}
            onClick={() => void confirmRemoveUpperFloor()}
            variant="destructive"
          >
            {floorRemoving && (
              <LoaderCircle aria-hidden className="motion-safe:animate-spin" />
            )}
            {floorRemoving ? 'Đang xóa tầng…' : 'Xóa tầng trên'}
          </Button>
        </ResourceConfirmation>
      )}
    </>
  );
}
