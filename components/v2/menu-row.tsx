// One line in a bottom sheet. Same hairline-separated rhythm as the Settings
// rows, so a sheet reads as part of the app rather than a system menu.
//
// Extracted from app/profile/[username]/profile-actions.tsx, which owned it
// first; the nudge sheet renders the same rows.
export function MenuRow({
  label,
  meta,
  marker,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  // Right-aligned secondary text: "3 of 4 left today", "5h/wk".
  meta?: string;
  // Optional leading element — the nudge sheet passes a goal's color marker.
  marker?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`border-divider flex w-full items-center gap-2 border-t py-3.5 text-left text-[15px] font-medium transition-transform first:border-t-0 active:scale-[.99] disabled:opacity-50 ${
        destructive ? "text-destructive" : "text-body"
      }`}
    >
      {marker}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {meta && (
        <span className="text-faint shrink-0 text-xs whitespace-nowrap">
          {meta}
        </span>
      )}
    </button>
  );
}
