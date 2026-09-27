process.env.SMS_PROVIDER ??= 'console';
process.env.OTP_HASH_SECRET ??= 'vexgo-test-only-otp-hash-secret';
process.env.OTP_TTL_SECONDS ??= '300';
process.env.OTP_RESEND_COOLDOWN_SECONDS ??= '60';
process.env.OTP_PROOF_TTL_SECONDS ??= '600';
process.env.JWT_ACCESS_SECRET ??= 'vexgo-test-only-access-secret';
process.env.JWT_ACCESS_TTL_SECONDS ??= '900';
process.env.REFRESH_TOKEN_TTL_SECONDS ??= '2592000';
