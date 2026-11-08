'use client';

import { useTranslations } from 'next-intl';
import { ResourceNotice } from '@/components/admin/resource-ui';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/action-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import {
  Armchair,
  ArrowLeft,
  BusFront,
  LoaderCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useVehicleFilterOptions } from '../hooks/use-vehicle-filter-options';
import {
  createVehicle,
  VehicleApiError,
} from '../services/vehicle-service';
import {
  VEHICLE_STATUSES,
  type VehicleSeatLayoutInput,
  type VehicleStatus,
} from '../types/vehicle';
import { SeatLayoutEditor } from './seat-layout-editor';
import {
  compactSeatNumbersAfterRemoval,
  type SeatLayoutItem,
} from './seat-layout-utils';

type FormValues = {
  licensePlate: string;
  vehicleTypeId: string;
  status: VehicleStatus;
};

type FormField = keyof FormValues;
type FieldErrors = Partial<Record<FormField | 'seats', string>>;

export function VehicleCreateWorkspace() {
  const tVehicles = useTranslations('vehicles');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const authState = useAdminSession();
  const tenantId =
    authState.status === 'authenticated'
      ? authState.session.busCompanyId
      : null;

  const options = useVehicleFilterOptions();

  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);

  const [values, setValues] = useState<FormValues>({
    licensePlate: '',
    vehicleTypeId: '',
    status: 'HOAT_DONG',
  });
  const [layoutSeats, setLayoutSeats] = useState<SeatLayoutItem[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const optionsReady =
    Boolean(tenantId) && options.vehicleTypes.status === 'success';

  function updateField<F extends FormField>(field: F, value: FormValues[F]) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const licensePlate = values.licensePlate.trim();
    const vehicleTypeId = Number(values.vehicleTypeId);

    if (!licensePlate) {
      errors.licensePlate = tVehicles('errors.plateRequired');
    } else if (licensePlate.length > 15) {
      errors.licensePlate = tVehicles('errors.plateMaxLength');
    }

    if (!Number.isSafeInteger(vehicleTypeId) || vehicleTypeId < 1) {
      errors.vehicleTypeId = tVehicles('errors.typeRequired');
    }

    if (!VEHICLE_STATUSES.includes(values.status)) {
      errors.status = tVehicles('errors.statusRequired');
    }

    if (layoutSeats.length === 0) {
      errors.seats = tVehicles('errors.seatsRequired');
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    setFormError(null);
    if (!optionsReady) {
      setFormError(tVehicles('unresolvedOperatorOrTypes'));
      return;
    }

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?.focus(),
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const savedVehicle = await createVehicle({
        licensePlate: values.licensePlate.trim(),
        busCompanyId: tenantId!,
        vehicleTypeId: Number(values.vehicleTypeId),
        status: values.status,
        seats: layoutSeats.map(
          ({
            seatNumber,
            position,
            floor,
            x,
            y,
          }): VehicleSeatLayoutInput => ({
            seatNumber,
            position,
            floor,
            x,
            y,
          }),
        ),
      });

      toast.success(tVehicles('createdSuccess', { plate: savedVehicle.licensePlate }));
      router.push(`/vehicles/${savedVehicle.vehicleId}`);
    } catch (requestError: unknown) {
      if (
        requestError instanceof VehicleApiError &&
        requestError.code === 'VEHICLE_LICENSE_PLATE_EXISTS'
      ) {
        setFieldErrors({ licensePlate: tVehicles('errors.plateExists') });
        requestAnimationFrame(() =>
          formRef.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        );
      } else if (requestError instanceof TypeError) {
        toast.error(tVehicles('networkError'));
      } else {
        const message =
          requestError instanceof Error
            ? requestError.message
            : tVehicles('saveError');
        setFormError(message);
        toast.error(message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const floor1Count = layoutSeats.filter((s) => s.floor === 1).length;
  const floor2Count = layoutSeats.filter((s) => s.floor === 2).length;

  return (
    <div className="admin-page-content admin-ui space-y-6">
      <AdminPageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button
              disabled={submitting}
              render={<Link href="/vehicles" />}
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              {tVehicles('backToVehicles')}
            </Button>
          </div>
        }
        eyebrow={tVehicles('eyebrow')}
        title={tVehicles('createVehicle')}
        titleId="create-vehicle-title"
      />

      <form
        className="space-y-6"
        noValidate
        onSubmit={handleSubmit}
        ref={formRef}
      >
        {formError && (
          <ResourceNotice kind="error">{formError}</ResourceNotice>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column: Basic info & Seat statistics */}
          <div className="space-y-6 lg:col-span-5 xl:col-span-4">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b p-5">
                <CardTitle className="text-base flex items-center gap-2">
                  <BusFront className="size-5 text-primary" />
                  {tVehicles('identificationTitle')}
                </CardTitle>
                <CardDescription>
                  {tVehicles('identificationSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <Field data-invalid={Boolean(fieldErrors.licensePlate)}>
                  <FieldLabel htmlFor="create-vehicle-license-plate">
                    {tVehicles('plateNumber')} <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Input
                    aria-describedby={
                      fieldErrors.licensePlate
                        ? 'create-vehicle-license-plate-error'
                        : undefined
                    }
                    aria-invalid={Boolean(fieldErrors.licensePlate)}
                    autoComplete="off"
                    className="admin-data-mono uppercase"
                    disabled={submitting}
                    id="create-vehicle-license-plate"
                    maxLength={15}
                    onChange={(event) =>
                      updateField('licensePlate', event.target.value)
                    }
                    placeholder={tVehicles('plateNumberPlaceholder')}
                    required
                    value={values.licensePlate}
                  />
                  <FieldError id="create-vehicle-license-plate-error">
                    {fieldErrors.licensePlate}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(fieldErrors.vehicleTypeId)}>
                  <FieldLabel htmlFor="create-vehicle-type">
                    {tVehicles('vehicleType')} <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Select
                    disabled={submitting || !optionsReady}
                    onValueChange={(value) =>
                      updateField('vehicleTypeId', String(value ?? ''))
                    }
                    value={values.vehicleTypeId || null}
                  >
                    <SelectTrigger
                      aria-describedby={
                        fieldErrors.vehicleTypeId
                          ? 'create-vehicle-type-error'
                          : undefined
                      }
                      aria-invalid={Boolean(fieldErrors.vehicleTypeId)}
                      id="create-vehicle-type"
                    >
                      <SelectValue placeholder={tVehicles('selectVehicleTypePlaceholder')}>
                        {options.vehicleTypes.status === 'success'
                          ? options.vehicleTypes.options.find(
                              (opt) => String(opt.id) === values.vehicleTypeId,
                            )?.label
                          : tVehicles('loadingFilterOptions')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectGroup>
                        {options.vehicleTypes.status === 'success' &&
                          options.vehicleTypes.options.map((option) => (
                            <SelectItem
                              key={option.id}
                              value={String(option.id)}
                            >
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError id="create-vehicle-type-error">
                    {fieldErrors.vehicleTypeId}
                  </FieldError>
                </Field>

                <Field data-invalid={Boolean(fieldErrors.status)}>
                  <FieldLabel htmlFor="create-vehicle-status">
                    {tVehicles('vehicleStatus')} <span aria-hidden="true">*</span>
                  </FieldLabel>
                  <Select
                    disabled={submitting}
                    onValueChange={(value) =>
                      updateField('status', value as VehicleStatus)
                    }
                    value={values.status}
                  >
                    <SelectTrigger
                      aria-describedby={
                        fieldErrors.status
                          ? 'create-vehicle-status-error'
                          : undefined
                      }
                      aria-invalid={Boolean(fieldErrors.status)}
                      id="create-vehicle-status"
                    >
                      <SelectValue>
                        {values.status === 'HOAT_DONG'
                          ? tVehicles('statusActive')
                          : tVehicles('statusMaintenance')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectGroup>
                        <SelectItem value="HOAT_DONG">
                          {tVehicles('statusActive')}
                        </SelectItem>
                        <SelectItem value="BAO_TRI">
                          {tVehicles('statusMaintenance')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError id="create-vehicle-status-error">
                    {fieldErrors.status}
                  </FieldError>
                </Field>
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 shadow-sm bg-muted/20">
              <CardHeader className="border-b p-5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Armchair className="size-5 text-primary" />
                  {tVehicles('seatStats')}
                </CardTitle>
                <CardDescription>
                  {tVehicles('seatStatsDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tVehicles('totalSeatsLabel')}:
                  </span>
                  <span className="font-bold text-base text-primary">
                    {tVehicles('seatCountBadge', { count: layoutSeats.length })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tVehicles('floorLower')}:
                  </span>
                  <span className="font-semibold">
                    {tVehicles('seatCountBadge', { count: floor1Count })}
                  </span>
                </div>
                {floor2Count > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {tVehicles('floorUpper')}:
                    </span>
                    <span className="font-semibold">
                      {tVehicles('seatCountBadge', { count: floor2Count })}
                    </span>
                  </div>
                )}
                {fieldErrors.seats && (
                  <p className="text-xs font-medium text-destructive pt-1">
                    {fieldErrors.seats}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 py-0 shadow-sm border-primary/20 bg-primary/5">
              <CardContent className="p-5 flex flex-col gap-3">
                <Button
                  aria-busy={submitting}
                  className="w-full"
                  disabled={submitting || !optionsReady}
                  size="default"
                  type="submit"
                >
                  {submitting && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 motion-safe:animate-spin"
                    />
                  )}
                  {submitting ? tVehicles('saving') : tVehicles('completeAndCreateVehicle')}
                </Button>
                <Button
                  className="w-full"
                  disabled={submitting}
                  render={<Link href="/vehicles" />}
                  variant="outline"
                >
                  {tCommon('cancel')}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right column: Visual Seat Layout Editor */}
          <div className="space-y-6 lg:col-span-7 xl:col-span-8">
            <Card className="gap-0 py-0 shadow-sm">
              <CardHeader className="border-b p-5">
                <CardTitle className="text-base">
                  {tVehicles('visualSeatLayout')}
                </CardTitle>
                <CardDescription>
                  {tVehicles('visualSeatLayoutDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <SeatLayoutEditor
                  canRemoveDraft
                  disabled={submitting}
                  error={fieldErrors.seats}
                  onChange={(nextSeats) => {
                    setLayoutSeats(nextSeats);
                    setFieldErrors((current) => ({
                      ...current,
                      seats: undefined,
                    }));
                  }}
                  onRemoveSeat={(seatNumber) =>
                    setLayoutSeats((current) =>
                      compactSeatNumbersAfterRemoval(current, seatNumber),
                    )
                  }
                  seats={layoutSeats}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
