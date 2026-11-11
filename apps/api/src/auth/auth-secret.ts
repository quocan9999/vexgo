export function requireAuthSecret(
  value: string | undefined,
  variableName: string,
): string {
  const secret = value?.trim();
  if (
    !secret ||
    secret.length < 32 ||
    secret.toLowerCase().includes('replace-with')
  ) {
    throw new Error(
      `${variableName} must contain at least 32 characters and cannot be a placeholder`,
    );
  }

  return secret;
}
