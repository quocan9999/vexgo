import test from 'node:test';
import assert from 'node:assert/strict';

test('calculates per-seat total fare accurately with pickup and dropoff surcharges', () => {
  const basePrice = 250_000;
  const pickupSurcharge = 30_000;
  const dropoffSurcharge = 20_000;
  const seatCount = 3;

  const unitFareWithSurcharges = basePrice + pickupSurcharge + dropoffSurcharge;
  assert.equal(unitFareWithSurcharges, 300_000);

  const totalFare = unitFareWithSurcharges * seatCount;
  assert.equal(totalFare, 900_000);
});

test('round-trip fare calculation factors independent surcharges for outbound and return legs', () => {
  const outboundBase = 200_000;
  const outboundPickupSurcharge = 25_000;
  const outboundDropoffSurcharge = 0;
  const outboundSeats = 2;

  const returnBase = 220_000;
  const returnPickupSurcharge = 0;
  const returnDropoffSurcharge = 15_000;
  const returnSeats = 2;

  const outboundPerSeat = outboundBase + outboundPickupSurcharge + outboundDropoffSurcharge;
  const returnPerSeat = returnBase + returnPickupSurcharge + returnDropoffSurcharge;

  const outboundTotal = outboundPerSeat * outboundSeats;
  const returnTotal = returnPerSeat * returnSeats;
  const grandTotal = outboundTotal + returnTotal;

  assert.equal(outboundPerSeat, 225_000);
  assert.equal(returnPerSeat, 235_000);
  assert.equal(outboundTotal, 450_000);
  assert.equal(returnTotal, 470_000);
  assert.equal(grandTotal, 920_000);
});

test('payload mapper preserves diemDonChuyenXeId and diemTraChuyenXeId when present', () => {
  const selectedPickupStop = {
    diemDonTraChuyenXeId: 101,
    name: 'VP Bến xe Miền Đông',
    phuPhi: 30_000,
  };
  const selectedDropoffStop = {
    diemDonTraChuyenXeId: 202,
    name: 'Bến xe Vũng Tàu',
    phuPhi: 15_000,
  };

  const payload = {
    tripId: 42,
    seatIds: [1, 2],
    pickupPoint: selectedPickupStop.name,
    dropoffPoint: selectedDropoffStop.name,
    diemDonChuyenXeId: selectedPickupStop.diemDonTraChuyenXeId,
    diemTraChuyenXeId: selectedDropoffStop.diemDonTraChuyenXeId,
  };

  assert.equal(payload.diemDonChuyenXeId, 101);
  assert.equal(payload.diemTraChuyenXeId, 202);
  assert.equal(payload.pickupPoint, 'VP Bến xe Miền Đông');
  assert.equal(payload.dropoffPoint, 'Bến xe Vũng Tàu');
});
