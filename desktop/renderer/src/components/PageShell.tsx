import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  hero?: string;
  heroClassName?: string;
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  hero,
  heroClassName = "page-hero",
  children,
}: PageShellProps) {
  return (
    <div className="page-shell fade-in">
      {hero && (
        <div className="page-hero-wrap">
          <img src={hero} alt="" className={heroClassName} />
        </div>
      )}
      <header className="page-header">
        <h2 className="page-title">{title}</h2>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </header>
      {children}
    </div>
  );
}
