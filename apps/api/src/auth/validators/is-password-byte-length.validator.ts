import { ValidateBy } from 'class-validator';

const PASSWORD_MIN_BYTES = 8;
const PASSWORD_MAX_BYTES = 72;

export function IsPasswordByteLength() {
  return ValidateBy({
    name: 'isPasswordByteLength',
    validator: {
      validate: (value: unknown) => {
        if (typeof value !== 'string') return false;
        const byteLength = Buffer.byteLength(value, 'utf8');
        return (
          byteLength >= PASSWORD_MIN_BYTES && byteLength <= PASSWORD_MAX_BYTES
        );
      },
      defaultMessage: () =>
        `Mật khẩu phải dài từ ${PASSWORD_MIN_BYTES} đến ${PASSWORD_MAX_BYTES} byte UTF-8.`,
    },
  });
}
