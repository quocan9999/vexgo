import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AdminCreateActionProps = {
  label: string;
  onClick: () => void;
};

type AdminRefreshActionProps = {
  loading: boolean;
  onClick: () => void;
};

export function AdminCreateAction({ label, onClick }: AdminCreateActionProps) {
  return (
    <Button className="admin-page-action" onClick={onClick}>
      <Plus aria-hidden="true" size={16} />
      {label}
    </Button>
  );
}

export function AdminRefreshAction({
  loading,
  onClick,
}: AdminRefreshActionProps) {
  return (
    <Button
      aria-busy={loading}
      className="admin-page-action"
      disabled={loading}
      onClick={onClick}
      variant="secondary"
    >
      <RefreshCw
        aria-hidden="true"
        className={loading ? 'admin-refresh-spinner' : undefined}
        size={16}
      />
      Làm mới
    </Button>
  );
}
