import { generateBusinessUuid } from '../common/business-uuid.js';

export function generateStandaloneShipmentCodes(
  _operatorCode?: string,
  _createdAt?: Date,
) {
  return {
    orderCode: generateBusinessUuid(),
    waybillCode: generateBusinessUuid(),
  };
}
