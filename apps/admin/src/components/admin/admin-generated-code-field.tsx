import { Button } from '@/components/ui/button';

type Props = {
  id: string;
  label: string;
  code: string;
  placeholder: string;
  error: string;
  onRetry: () => void;
};

export function AdminGeneratedCodeField({
  id,
  label,
  code,
  placeholder,
  error,
  onRetry,
}: Props) {
  return (
    <div className="admin-crud-form-field">
      <label htmlFor={id}>{label} (tự động)</label>
      <input
        className="admin-data-mono admin-generated-code"
        id={id}
        disabled
        value={code}
        placeholder={placeholder}
      />
      {error && (
        <div role="alert">
          {error}{' '}
          <Button type="button" variant="secondary" onClick={onRetry}>
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
}
