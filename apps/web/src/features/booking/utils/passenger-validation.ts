export interface PassengerInfo {
  fullName: string;
  phoneNumber: string;
  email: string;
}

export interface PassengerValidationErrors {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
}

export function validatePassengerInfo(passenger: PassengerInfo): {
  isValid: boolean;
  errors: PassengerValidationErrors;
} {
  const errors: PassengerValidationErrors = {};
  const trimmedName = passenger.fullName.trim();
  const trimmedPhone = passenger.phoneNumber.trim();
  const trimmedEmail = passenger.email.trim();

  if (!trimmedName) {
    errors.fullName = 'Vui lòng nhập họ và tên';
  }

  const cleanedPhone = trimmedPhone.replace(/\D/g, '');
  const isVietnamesePhone = /^(0|84)(3|5|7|8|9)\d{8}$/.test(cleanedPhone);
  if (!trimmedPhone) {
    errors.phoneNumber = 'Vui lòng nhập số điện thoại';
  } else if (!isVietnamesePhone) {
    errors.phoneNumber = 'Số điện thoại không hợp lệ';
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail) {
    errors.email = 'Vui lòng nhập email';
  } else if (!emailPattern.test(trimmedEmail)) {
    errors.email = 'Email không hợp lệ';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
