export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function resolveBusinessTimeZone(
  configuredTimeZone: string | undefined,
): string {
  return configuredTimeZone || DEFAULT_BUSINESS_TIME_ZONE;
}

export function getBusinessDate(
  timeZone: string,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`Missing ${type} while resolving business date.`);
    return value;
  };

  return `${partValue('year').padStart(4, '0')}-${partValue('month')}-${partValue('day')}`;
}

export function businessDateStartUtc(dateOnly: string, timeZone: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let candidateUtc = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidateUtc));
    const partValue = (type: Intl.DateTimeFormatPartTypes) => {
      const value = parts.find((part) => part.type === type)?.value;
      if (!value) throw new Error(`Missing ${type} while resolving business date.`);
      return Number(value);
    };
    const representedAsUtc = Date.UTC(
      partValue('year'),
      partValue('month') - 1,
      partValue('day'),
      partValue('hour'),
      partValue('minute'),
      partValue('second'),
    );
    const nextCandidateUtc = targetUtc - (representedAsUtc - candidateUtc);
    if (nextCandidateUtc === candidateUtc) break;
    candidateUtc = nextCandidateUtc;
  }

  return new Date(candidateUtc);
}

export function combineDeparture(
  date: Date,
  time: Date,
  businessTimeZone: string,
): Date {
  const businessDate = date.toISOString().slice(0, 10);
  const businessDayStart = businessDateStartUtc(businessDate, businessTimeZone);
  const elapsedSinceMidnight =
    ((time.getUTCHours() * 60 + time.getUTCMinutes()) * 60 +
      time.getUTCSeconds()) *
    1000;
  return new Date(businessDayStart.getTime() + elapsedSinceMidnight);
}

export function computeArrival(
  departureDate: Date,
  departureTime: Date,
  durationMinutes: number | null | undefined,
  fallbackGioDen: Date | null | undefined,
  businessTimeZone: string,
): string | null {
  const depTime = combineDeparture(departureDate, departureTime, businessTimeZone);
  if (durationMinutes != null && Number.isFinite(durationMinutes) && durationMinutes > 0) {
    return new Date(depTime.getTime() + durationMinutes * 60 * 1000).toISOString();
  }
  if (!fallbackGioDen) return null;
  let arrTime = combineDeparture(departureDate, fallbackGioDen, businessTimeZone);
  if (arrTime < depTime) {
    arrTime = new Date(arrTime.getTime() + 24 * 60 * 60 * 1000);
  }
  return arrTime.toISOString();
}

export function calculateClockTime(
  baseTime: Date,
  durationMinutes: number | null | undefined,
): Date | null {
  if (durationMinutes == null || !Number.isFinite(durationMinutes)) return null;
  const totalSeconds =
    baseTime.getUTCHours() * 3600 +
    baseTime.getUTCMinutes() * 60 +
    baseTime.getUTCSeconds() +
    Math.round(durationMinutes * 60);
  const normalizedSeconds = ((totalSeconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normalizedSeconds / 3600);
  const minutes = Math.floor((normalizedSeconds % 3600) / 60);
  const seconds = normalizedSeconds % 60;
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
}

