type AdminTableSkeletonProps = {
  resourceLabel: string;
};

export function AdminTableSkeleton({ resourceLabel }: AdminTableSkeletonProps) {
  return (
    <div
      aria-label={`Đang tải danh sách ${resourceLabel}`}
      className="admin-table-skeleton"
      role="status"
    >
      {Array.from({ length: 5 }, (_, index) => (
        <div
          aria-hidden="true"
          className="admin-table-skeleton-row"
          key={index}
        >
          <span className="skeleton admin-table-skeleton-primary" />
          <span className="skeleton admin-table-skeleton-secondary" />
          <span className="skeleton admin-table-skeleton-number" />
          <span className="skeleton admin-table-skeleton-number" />
          <span className="skeleton admin-table-skeleton-number" />
        </div>
      ))}
      <span className="sr-only">Đang tải dữ liệu {resourceLabel}…</span>
    </div>
  );
}
