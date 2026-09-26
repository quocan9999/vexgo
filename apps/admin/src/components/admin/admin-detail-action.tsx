import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

type AdminDetailActionProps = {
  onClick: () => void;
  resourceName: string;
};

export function AdminDetailAction({
  onClick,
  resourceName,
}: AdminDetailActionProps) {
  return (
    <Button
      aria-label={`Xem chi tiết ${resourceName}`}
      className="admin-detail-action"
      onClick={onClick}
      variant="secondary"
    >
      <Eye aria-hidden="true" size={15} />
      Xem chi tiết
    </Button>
  );
}
