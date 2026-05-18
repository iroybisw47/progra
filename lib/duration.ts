export function nowTs(): number {
  return Date.now();
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Shared base: clamp to whole non-negative seconds. Both the live timer
// (HH:MM:SS) and the magnitude formatter ("1h 23m") derive from this.
function totalSeconds(ms: number): number {
  return Math.max(0, Math.floor(ms / 1000));
}

export function formatElapsed(ms: number): string {
  const total = totalSeconds(ms);
  return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
}

export function formatDuration(ms: number): string {
  const total = totalSeconds(ms);
  if (total < 60) return `${total}s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
