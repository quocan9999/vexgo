import { Button } from '@/components/ui/action-button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export function ResourceGeneratedCodeField({
  id,
  label,
  code,
  placeholder,
  error,
  onRetry,
  busy = false,
}: {
  id: string;
  label: string;
  code: string;
  placeholder: string;
  error: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label} (tự động)</FieldLabel>
      <Input
        className="admin-data-mono bg-muted"
        id={id}
        disabled
        value={code}
        placeholder={placeholder}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <div>
          <FieldError id={`${id}-error`}>{error}</FieldError>
          <Button
            className="mt-2"
            disabled={busy}
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            Thử lại
          </Button>
        </div>
      )}
    </Field>
  );
}
