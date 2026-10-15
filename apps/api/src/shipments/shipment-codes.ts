import { randomUUID } from 'node:crypto';

function normalizedOperatorCode(operatorCode: string): string {
  return (
    operatorCode
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 8)
      .toUpperCase() || 'VXG'
  );
}

function formatShipmentTimestamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}${month}${year}${hour}${minute}`;
}

export function generateStandaloneShipmentCodes(
  operatorCode: string,
  createdAt: Date,
) {
  const prefix = normalizedOperatorCode(operatorCode);
  const timestamp = formatShipmentTimestamp(createdAt);
  const uniqueSuffix = randomUUID()
    .replaceAll('-', '')
    .slice(0, 25)
    .toUpperCase();

  return {
    orderCode: `${prefix}-GD-${timestamp}-${uniqueSuffix}`,
    waybillCode: `${prefix}-VD-${timestamp}-${uniqueSuffix}`,
  };
}
