import type { BusCompany } from '@/features/bus-companies/types/bus-company';
import type { VehicleType } from '@/features/vehicle-types/types/vehicle-type';
import { VEHICLE_STATUS_OPTIONS, type VehicleStatus } from '../types/vehicle';

export type VehicleFormValues = {
  licensePlate: string;
  busCompanyId: string;
  vehicleTypeId: string;
  status?: VehicleStatus;
};

export type VehicleFormField = keyof VehicleFormValues;

export type VehicleFormErrors = Partial<
  Record<'licensePlate' | 'busCompanyId' | 'vehicleTypeId' | 'status', string>
>;

export function VehicleFormFields({
  idPrefix,
  values,
  errors,
  busCompanies,
  vehicleTypes,
  onChange,
  showStatus,
}: {
  idPrefix: string;
  values: VehicleFormValues;
  errors: VehicleFormErrors;
  busCompanies: BusCompany[];
  vehicleTypes: VehicleType[];
  onChange: (field: VehicleFormField, value: string) => void;
  showStatus: boolean;
}) {
  const fields = [
    {
      field: 'licensePlate' as const,
      label: 'Biển số xe',
      inputId: `${idPrefix}-license-plate`,
    },
    {
      field: 'busCompanyId' as const,
      label: 'Nhà xe',
      inputId: `${idPrefix}-bus-company`,
    },
    {
      field: 'vehicleTypeId' as const,
      label: 'Loại xe',
      inputId: `${idPrefix}-vehicle-type`,
    },
  ];

  return (
    <>
      {fields.map(({ field, label, inputId }) => (
        <div className="vehicle-form-field" key={field}>
          <label htmlFor={inputId}>{label}</label>
          {field === 'licensePlate' ? (
            <input
              autoComplete="off"
              id={inputId}
              maxLength={15}
              onChange={(event) => onChange(field, event.target.value)}
              placeholder="Ví dụ: 51B-123.45"
              required
              type="text"
              value={values.licensePlate}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `${inputId}-error` : undefined}
            />
          ) : (
            <select
              id={inputId}
              onChange={(event) => onChange(field, event.target.value)}
              required
              value={values[field] ?? ''}
              aria-invalid={Boolean(errors[field])}
              aria-describedby={errors[field] ? `${inputId}-error` : undefined}
            >
              <option value="">Chọn {label.toLocaleLowerCase('vi-VN')}</option>
              {field === 'busCompanyId'
                ? busCompanies.map((company) => (
                    <option
                      key={company.busCompanyId}
                      value={String(company.busCompanyId)}
                    >
                      {company.code} · {company.name}
                    </option>
                  ))
                : vehicleTypes.map((vehicleType) => (
                    <option
                      key={vehicleType.vehicleTypeId}
                      value={String(vehicleType.vehicleTypeId)}
                    >
                      {vehicleType.name}
                    </option>
                  ))}
            </select>
          )}
          {errors[field] && (
            <span className="vehicle-form-field-error" id={`${inputId}-error`}>
              {errors[field]}
            </span>
          )}
        </div>
      ))}

      {showStatus && (
        <div className="vehicle-form-field">
          <label htmlFor={`${idPrefix}-status`}>Trạng thái</label>
          <select
            id={`${idPrefix}-status`}
            onChange={(event) => onChange('status', event.target.value)}
            required
            value={values.status ?? 'HOAT_DONG'}
            aria-invalid={Boolean(errors.status)}
            aria-describedby={
              errors.status ? `${idPrefix}-status-error` : undefined
            }
          >
            {VEHICLE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.status && (
            <span
              className="vehicle-form-field-error"
              id={`${idPrefix}-status-error`}
            >
              {errors.status}
            </span>
          )}
        </div>
      )}
    </>
  );
}
