'use client';

import { useTranslations } from 'next-intl';
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
  const tVehicles = useTranslations('vehicles');
  const tCommon = useTranslations('common');
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
      setInteractionMessage(tVehicles('seatCollisionError'));
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
    const current = seat[axis];
    const min = axis === 'x' ? 110 : 1000;
    const max = axis === 'x' ? 890 : 30000;
    const next = Math.max(min, Math.min(max, current + delta));
    if (next !== current) updateGroup(group, seat.floor, axis, next);
  }

  function startDrag(
    event: PointerEvent<HTMLButtonElement>,
    seat: SeatLayoutItem,
  ) {
    if (busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      seatNumber: seat.seatNumber,
      floor: seat.floor,
      startX: seat.x,
      startY: seat.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    setSelectedSeatNumber(seat.seatNumber);
    setAlignmentGuides({ x: seat.x, y: seat.y });
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return;

    const deltaX = ((event.clientX - drag.pointerX) / rect.width) * 1000;
    const deltaY = (event.clientY - drag.pointerY) / VERTICAL_UNIT_PX;
    const rawX = Math.round(drag.startX + deltaX);
    const rawY = Math.round(drag.startY + deltaY);
    const boundedX = Math.max(110, Math.min(890, rawX));
    const boundedY = Math.max(1000, Math.min(30000, rawY));

    const otherSeats = seats.filter(
      (seat) =>
        seat.floor === drag.floor && seat.seatNumber !== drag.seatNumber,
    );
    const candidateXAlignments = Array.from(
      new Set(otherSeats.map((seat) => seat.x)),
    );
    const candidateYAlignments = Array.from(
      new Set(otherSeats.map((seat) => seat.y)),
    );

    const nearestX = candidateXAlignments
      .map((targetX) => ({
        targetX,
        distance: Math.abs(targetX - boundedX),
      }))
      .filter((candidate) => candidate.distance <= 40)
      .sort((a, b) => a.distance - b.distance)[0]?.targetX;

    const nearestY = candidateYAlignments
      .map((targetY) => ({
        targetY,
        distance: Math.abs(targetY - boundedY),
      }))
      .filter((candidate) => candidate.distance <= 140)
      .sort((a, b) => a.distance - b.distance)[0]?.targetY;

    const targetX = nearestX ?? boundedX;
    const targetY = nearestY ?? boundedY;

    const destinationCandidates = [
      { x: targetX, y: targetY, guideX: nearestX ?? null, guideY: nearestY ?? null },
      { x: targetX, y: boundedY, guideX: nearestX ?? null, guideY: null },
      { x: boundedX, y: targetY, guideX: null, guideY: nearestY ?? null },
      { x: boundedX, y: boundedY, guideX: null, guideY: null },
    ];

    const destination = destinationCandidates.find(
      (candidate) =>
        !otherSeats.some(
          (seat) =>
            Math.abs(seat.x - candidate.x) < 180 &&
            Math.abs(seat.y - candidate.y) < 875,
        ),
    );

    if (!destination) {
      setAlignmentGuides({ x: null, y: null });
      setInteractionMessage(tVehicles('seatCollisionError'));
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
      setInteractionMessage(tVehicles('maxSeatsReached'));
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
        addError instanceof Error ? addError.message : tVehicles('cannotAddSeat'),
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
      setInteractionMessage(tVehicles('saveLayoutFirstBeforeRemovingDeck'));
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
        error instanceof Error ? error.message : tVehicles('cannotRemoveUpperDeck'),
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
        aria-label={tVehicles('deckAriaLabel', {
          floor: floor === 1 ? tVehicles('floorLower') : tVehicles('floorUpper'),
        })}
        className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-b-[32px] border-x border-b border-slate-300/80 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 shadow-inner select-none"
        onPointerCancel={stopDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        ref={floor === activeVisibleFloor ? canvasRef : undefined}
        role="group"
        style={{
          height,
          backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.15) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
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
            {tVehicles('emptyDeckDesc')}
          </div>
        ) : (
          seatsOnFloor.map((seat) => {
            const selected = selectedSeatNumber === seat.seatNumber;
            return (
              <Button
                aria-label={tVehicles('seatAriaLabel', {
                  seatNumber: seat.seatNumber,
                  floor: floor === 1 ? tVehicles('floorLower') : tVehicles('floorUpper'),
                })}
                aria-pressed={selected}
                className={`absolute z-10 h-14 w-[58px] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-xl px-1 transition-all duration-150 ${
                  selected
                    ? 'bg-primary text-primary-foreground shadow-[var(--admin-shadow-md)] ring-3 ring-primary/25 scale-[1.03] border-primary'
                    : 'bg-card text-foreground border border-slate-300/90 dark:border-slate-700 shadow-2xs hover:border-primary/60 hover:shadow-xs hover:scale-[1.02]'
                } ${busy ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
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
                <span className="max-w-full truncate font-mono text-[10.5px] font-bold">
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
            aria-label={tVehicles('floorCount')}
            className={`grid ${hasFloorTwo ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <TabsTrigger value="1">
              {hasFloorTwo ? tVehicles('floorLower') : tVehicles('seatCount')}
            </TabsTrigger>
            {hasFloorTwo && <TabsTrigger value="2">{tVehicles('floorUpper')}</TabsTrigger>}
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
              {tVehicles('removeUpperDeck')}
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
              {tVehicles('addUpperDeck')}
            </Button>
          )}
        </div>

        <Card className="h-auto gap-0 py-0">
          <CardHeader className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">{tVehicles('visualSeatLayout')}</CardTitle>
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto">
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="text-sm font-medium text-muted-foreground"
                  id={`seat-column-count-${activeVisibleFloor}`}
                >
                  {tVehicles('columnsCount')}
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
                      {tVehicles('columnsOption', {
                        count: columnCounts[activeVisibleFloor] ?? 4,
                      })}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {[1, 2, 3, 4, 5].map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {tVehicles('columnsOption', { count })}
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
                    {tVehicles('editSelectedSeat')}
                  </Button>
                )}
              <Button
                disabled={busy || !canAdd || seats.length >= MAX_VEHICLE_SEATS}
                onClick={() => void addSeat()}
                variant="outline"
              >
                <Plus aria-hidden />
                {adding ? tVehicles('addingSeat') : tVehicles('addSeat')}
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
                    {deletingSeat ? tVehicles('deletingSeat') : tVehicles('deleteSelectedSeat')}
                  </Button>
                )}
              {onSave && (
                <Button
                  aria-busy={saving}
                  disabled={busy || !dirty || seats.length === 0}
                  onClick={onSave}
                >
                  {saving ? tVehicles('saving') : tVehicles('saveLayout')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-5">
            <div className="mx-auto flex w-full max-w-[460px] items-center justify-between rounded-t-[32px] border border-b-0 border-slate-300/80 dark:border-slate-700 bg-gradient-to-b from-slate-100 to-card px-5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 px-2.5 py-1 text-blue-700 dark:text-blue-300">
                <BusFront aria-hidden className="size-4 text-blue-600 dark:text-blue-400" />
                {tVehicles('driverPosition')}
              </span>
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-400">
                {tVehicles('vehicleFront')}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-slate-600 dark:text-slate-400">
                {tVehicles('passengerDoorArrow')}
              </span>
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
                {tVehicles('seatsFootnote', {
                  count: seats.length.toLocaleString(),
                  max: MAX_VEHICLE_SEATS,
                })}
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
              ? tVehicles('deckRemovalDraftDesc', { count: upperFloorSeats.length })
              : tVehicles('deckRemovalServerDesc', { count: upperFloorSeats.length })
          }
          onClose={() => {
            if (!floorRemoving) setFloorRemovalOpen(false);
          }}
          title={tVehicles('deckRemovalTitle')}
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
            {floorRemoving ? tVehicles('deletingDeck') : tVehicles('deckRemovalConfirm')}
          </Button>
        </ResourceConfirmation>
      )}
    </>
  );
}
