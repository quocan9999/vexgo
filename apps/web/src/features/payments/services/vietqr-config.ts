export type VietQrAccountConfig = {
  bankId: string;
  accountNumber: string;
  accountName: string;
};

type RawVietQrAccountConfig = {
  bankId?: string;
  accountNumber?: string;
  accountName?: string;
};

export function readVietQrAccountConfig(
  values: RawVietQrAccountConfig,
): VietQrAccountConfig | null {
  const bankId = values.bankId?.trim();
  const accountNumber = values.accountNumber?.trim();
  const accountName = values.accountName?.trim();

  if (!bankId || !/^[A-Za-z0-9]{2,32}$/.test(bankId)) return null;
  if (!accountNumber || !/^[A-Za-z0-9]{1,19}$/.test(accountNumber)) return null;
  if (
    !accountName ||
    accountName.length > 100 ||
    /[\u0000-\u001f\u007f]/.test(accountName)
  ) {
    return null;
  }

  return { bankId, accountNumber, accountName };
}

export function createVietQrImageUrl(
  config: VietQrAccountConfig | null,
  amount: number,
  transferContent: string,
): string | null {
  if (!config || !Number.isFinite(amount) || amount < 0 || !transferContent.trim()) {
    return null;
  }

  const memo = encodeURIComponent(transferContent);
  return `https://img.vietqr.io/image/${config.bankId}-${config.accountNumber}-compact2.png?amount=${amount}&addInfo=${memo}&accountName=${encodeURIComponent(config.accountName)}`;
}
