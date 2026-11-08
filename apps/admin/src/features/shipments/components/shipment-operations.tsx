'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/action-button';
import { Card } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ResourceConfirmation,
  ResourceNotice,
} from '@/components/admin/resource-ui';
import { LabeledSelectFilter } from '@/components/data-filters/labeled-select-filter';
import type { ShipmentDetail } from '../types/shipment';
import {
  buildAcceptanceItems,
  shipmentOperation,
  ShipmentOperationError,
  type MeasurementDraft,
  type EligibleShipmentTrip,
} from '../services/shipment-operations';
import { formatCurrency, formatDateTime } from './shipment-details';

type Operation = 'accept' | 'assignment' | 'collect-payment';

export function ShipmentOperations({
  shipment,
  onUpdated,
}: {
  shipment: ShipmentDetail;
  onUpdated: () => void;
}) {
  const t = useTranslations('shipments');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementDraft[]>([]);
  const [trips, setTrips] = useState<EligibleShipmentTrip[]>([]);
  const [tripId, setTripId] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [priceChange, setPriceChange] = useState<{
    before: number;
    after: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  async function open(next: Operation) {
    setError('');
    setNote('');
    setAmount('');
    setPriceChange(null);
    setTripId('');
    setMeasurements(
      shipment.cargoItems.map((item) => ({
        cargoId: item.cargoId,
        weight: '',
        length: '',
        width: '',
        height: '',
      })),
    );
    if (next === 'assignment') {
      setBusy(true);
      try {
        setTrips(
          await shipmentOperation<EligibleShipmentTrip[]>(
            shipment.shipmentId,
            'available-trips',
            'GET',
          ),
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : t('cannotLoadTrips'),
        );
        return;
      } finally {
        setBusy(false);
      }
    }
    setOperation(next);
  }
  async function submit() {
    if (!operation || locked.current) return;
    setError('');
    try {
      let payload: unknown;
      if (operation === 'accept') {
        if (priceChange && !note.trim())
          throw new Error(t('reasonRequired'));
        payload = {
          items: buildAcceptanceItems(measurements),
          note: note.trim() || undefined,
          confirmPriceChange: Boolean(priceChange),
        };
      } else if (operation === 'assignment') {
        if (!tripId) throw new Error(t('selectEligibleTrip'));
        payload = { tripId: Number(tripId), note: note.trim() || undefined };
      } else if (operation === 'collect-payment') {
        if (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0)
          throw new Error(t('positiveAmountRequired'));
        payload = { amount: Number(amount), note: note.trim() || undefined };
      }
locked.current = true;
      setBusy(true);
      await shipmentOperation(
        shipment.shipmentId,
        operation,
        operation === 'assignment' ? 'PATCH' : 'POST',
        payload,
      );
      toast.success(t('operationSuccess'));
      setOperation(null);
      onUpdated();
    } catch (err) {
      if (
        err instanceof ShipmentOperationError &&
        err.code === 'SHIPMENT_PRICE_CONFIRMATION_REQUIRED' &&
        err.previousFee !== undefined &&
        err.totalFee !== undefined
      ) {
        setPriceChange({ before: err.previousFee, after: err.totalFee });
      } else
        setError(
          err instanceof Error ? err.message : t('operationFailed'),
        );
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const title =
    operation === 'accept'
      ? t('weighAndReceive')
      : operation === 'assignment'
        ? t('assignOrTransfer')
        : operation === 'collect-payment'
          ? t('recordCashPayment')
          : t('reconcileRecords');
  return (
    <>
      <Card className="min-w-0 gap-4 p-4">
        <h3 className="text-base font-semibold">{t('opsCardTitle')}</h3>
        <p className="text-[13px] text-muted-foreground">
          {t('opsCardDesc')}
        </p>
        <div className="flex flex-wrap gap-3">
          {shipment.status === 'MOI_TAO' && (
            <Button disabled={busy} onClick={() => void open('accept')}>
              {t('weighAndReceiveBtn')}
            </Button>
          )}
          {shipment.status === 'DA_TIEP_NHAN' && (
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => void open('assignment')}
            >
              {shipment.trip ? t('transferTrip') : t('assignTrip')}
            </Button>
          )}
          {shipment.status !== 'DA_HUY' &&
            shipment.status !== 'MOI_TAO' &&
            shipment.paymentStatus !== 'DA_THANH_TOAN' && (
              <Button
                disabled={busy}
                variant="outline"
                onClick={() => void open('collect-payment')}
              >
                {t('recordCashBtn')}
              </Button>
            )}
        </div>
        <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('dropoffDeadline')}</dt>
            <dd>{formatDateTime(shipment.dropoffDeadline)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('expectedSendDate')}</dt>
            <dd>{shipment.expectedSendDate || t('flexibleSendDeadline')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('estimatedFreight')}</dt>
            <dd>
              {shipment.feeSummary.estimatedFee == null
                ? t('noData')
                : formatCurrency(shipment.feeSummary.estimatedFee)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('finalizedFreight')}</dt>
            <dd>
              {shipment.feeSummary.confirmedAt
                ? `${formatCurrency(shipment.totalFee)} · ${formatDateTime(shipment.feeSummary.confirmedAt)}`
                : t('notFinalizedAtCounter')}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('collectedAmount')}</dt>
            <dd>
              {shipment.feeSummary.paidAmount == null
                ? t('noData')
                : formatCurrency(shipment.feeSummary.paidAmount)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('remainingAmount')}</dt>
            <dd>
              {shipment.feeSummary.outstandingAmount == null
                ? t('noData')
                : formatCurrency(shipment.feeSummary.outstandingAmount)}
            </dd>
          </div>
        </dl>
      </Card>
      
      {operation && (
        <ResourceConfirmation
          title={title}
          description={t('opsConfirmationDesc')}
          busy={busy}
          onClose={() => setOperation(null)}
        >
          <form
            className="grid min-w-0 gap-4 max-h-[60dvh] overflow-y-auto"
            aria-describedby={error ? 'shipment-operation-error' : undefined}
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {operation === 'accept' &&
              measurements.map((item, index) => (
                <fieldset
                  key={item.cargoId}
                  className="grid gap-3 rounded-lg border p-3"
                >
                  <legend className="px-1 text-[13px] font-semibold">
                    {t('declaredWeightLegend', {
                      name: shipment.cargoItems[index].name,
                      weight:
                        shipment.cargoItems[index].declaredWeightKg ??
                        shipment.cargoItems[index].weightKg,
                    })}
                  </legend>
                  <div className="grid grid-cols-2 gap-3">
                    {(['weight', 'length', 'width', 'height'] as const).map(
                      (key) => (
                        <Field key={key}>
                          <FieldLabel
                            htmlFor={`measure-${item.cargoId}-${key}`}
                          >
                            {
                              {
                                weight: t('actualWeightKg'),
                                length: t('lengthCm'),
                                width: t('widthCm'),
                                height: t('heightCm'),
                              }[key]
                            }
                          </FieldLabel>
                          <Input
                            id={`measure-${item.cargoId}-${key}`}
                            type="number"
                            step="any"
                            min="0.001"
                            required={key === 'weight'}
                            disabled={busy}
                            value={item[key]}
                            onChange={(e) => {
                              setPriceChange(null);
                              setMeasurements((current) =>
                                current.map((row) =>
                                  row.cargoId === item.cargoId
                                    ? { ...row, [key]: e.target.value }
                                    : row,
                                ),
                              );
                            }}
                          />
                        </Field>
                      ),
                    )}
                  </div>
                </fieldset>
              ))}
            {operation === 'assignment' && (
              <>
                <LabeledSelectFilter
                  label={t('eligibleTripLabel')}
                  value={tripId}
                  onChange={setTripId}
                  disabled={busy}
                  options={trips.map((trip) => ({
                    value: String(trip.tripId),
                    label: `${trip.code} · ${trip.departureDate} ${trip.departureTime}`,
                  }))}
                />
                {!trips.length && (
                  <p role="status" className="text-[13px]">
                    {t('noEligibleTrips')}
                  </p>
                )}
              </>
            )}
            {operation === 'collect-payment' && (
              <Field>
                <FieldLabel htmlFor="shipment-actual-amount">
                  {t('actualCashAmount')}
                </FieldLabel>
                <Input
                  id="shipment-actual-amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  disabled={busy}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="shipment-operation-note">
                {Boolean(priceChange)
                  ? t('noteRequired')
                  : t('noteOptional')}
              </FieldLabel>
              <Textarea
                id="shipment-operation-note"
                maxLength={500}
                required={
                  Boolean(priceChange)
                }
                value={note}
                disabled={busy}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            {priceChange && (
              <ResourceNotice>
                {t('priceChangeNotice', {
                  before: formatCurrency(priceChange.before),
                  after: formatCurrency(priceChange.after),
                })}
              </ResourceNotice>
            )}
            {error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                id="shipment-operation-error"
                className="text-[13px] text-destructive"
              >
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy || (operation === 'assignment' && !tripId)}
            >
              {busy
                ? t('recordingState')
                : priceChange
                  ? t('customerAgreedAccept')
                  : t('confirmRecord')}
            </Button>
          </form>
        </ResourceConfirmation>
      )}
    </>
  );
}
