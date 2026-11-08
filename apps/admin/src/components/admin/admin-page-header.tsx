import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  actions?: ReactNode;
  eyebrow?: string;
  title: string;
  titleId: string;
};

export function AdminPageHeader({
  actions,
  eyebrow: _eyebrow,
  title,
  titleId,
}: AdminPageHeaderProps) {
  if (!actions) {
    return (
      <section aria-labelledby={titleId} className="page-intro sr-only">
        <h1 id={titleId}>{title}</h1>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className="page-intro page-intro-actions-bar"
    >
      <h1 id={titleId} className="sr-only">
        {title}
      </h1>
      <div className="page-intro-actions">{actions}</div>
    </section>
  );
}
