import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  actions?: ReactNode;
  eyebrow: string;
  title: string;
  titleId: string;
};

export function AdminPageHeader({
  actions,
  eyebrow,
  title,
  titleId,
}: AdminPageHeaderProps) {
  return (
    <section aria-labelledby={titleId} className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id={titleId}>{title}</h1>
      </div>
      {actions}
    </section>
  );
}
