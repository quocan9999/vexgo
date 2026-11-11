import {
  IsBoolean,
  IsDefined,
  IsNumber,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DEFAULT_LUGGAGE_RATES = {
  packageS: 50_000,
  packageSMaxKg: 5,
  packageM: 80_000,
  packageMMaxKg: 10,
  packageL: 120_000,
  packageLMaxKg: 20,
  packageXL: 180_000,
  packageXLMaxKg: 35,
  motorcycleWave: 180_000,
  motorcycleScooter: 220_000,
  motorcycleBig: 250_000,
  bicycle: 80_000,
  fragileSurcharge: 20_000,
  valuableSurcharge: 50_000,
  maxFreeWeightKg: 7,
};

export type LuggageRates = typeof DEFAULT_LUGGAGE_RATES;

export function resolveEffectiveLuggageRates(
  cauHinhHanhLyJson?: string | null,
  routeId?: number,
): LuggageRates {
  let parsed: any = null;
  if (cauHinhHanhLyJson) {
    try {
      parsed = JSON.parse(cauHinhHanhLyJson);
    } catch {
      parsed = null;
    }
  }

  const defaultRates: LuggageRates = {
    ...DEFAULT_LUGGAGE_RATES,
    ...(parsed?.default ?? {}),
  };

  const routeOverride =
    routeId !== undefined ? parsed?.routes?.[routeId] : undefined;
  const isOverridden = routeOverride && !routeOverride.inherit;

  return isOverridden
    ? {
        ...defaultRates,
        ...routeOverride,
      }
    : defaultRates;
}

export class LuggageRatesPackagePricingDto {
  @IsNumber()
  @Min(0)
  packageS: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageSMaxKg?: number;

  @IsNumber()
  @Min(0)
  packageM: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageMMaxKg?: number;

  @IsNumber()
  @Min(0)
  packageL: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageLMaxKg?: number;

  @IsNumber()
  @Min(0)
  packageXL: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageXLMaxKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  motorcycleWave?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  motorcycleScooter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  motorcycleBig?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bicycle?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fragileSurcharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valuableSurcharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxFreeWeightKg?: number;
}

export class RouteLuggageRateOverrideDto {
  @IsBoolean()
  inherit: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageS?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageSMaxKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageM?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageMMaxKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageL?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageLMaxKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packageXL?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  packageXLMaxKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  motorcycleWave?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  motorcycleScooter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  motorcycleBig?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bicycle?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fragileSurcharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  valuableSurcharge?: number;
}

export class UpdateLuggageRatesDto {
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LuggageRatesPackagePricingDto)
  default: LuggageRatesPackagePricingDto;

  @IsOptional()
  @IsObject()
  routes?: Record<string, RouteLuggageRateOverrideDto>;
}
