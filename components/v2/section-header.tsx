import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

// The eyebrow that opens every section on the flat screens: a 10px uppercase
// label, a right-aligned count, and a chevron when the section leads somewhere.
// One component so Progress, You and the friend profile can't drift apart.
export function SectionHeader({
  label,
  meta,
  href,
  onClick,
  className = "",
  ariaLabel,
}: {
  label: string;
  meta?: string;
  // A section either navigates (href) or opens a sheet (onClick); with
  // neither, it renders as a plain, non-interactive eyebrow.
  href?: string;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  const inner = (
    <>
      <span className="section-label">{label}</span>
      <span className="flex-1" />
      {meta && (
        <span className="text-caption text-[10px] font-semibold tracking-[0.06em]">
          {meta}
        </span>
      )}
      {(href || onClick) && (
        <ChevronRightIcon
          aria-hidden
          className="text-disabled size-[13px]"
          strokeWidth={2.4}
        />
      )}
    </>
  );

  const shared = `flex w-full items-center gap-[7px] ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={shared}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={shared}
      >
        {inner}
      </button>
    );
  }
  return <div className={shared}>{inner}</div>;
}
