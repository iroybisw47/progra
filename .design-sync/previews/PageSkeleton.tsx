import { PageSkeleton } from "progra";

// Route loading states (app/**/loading.tsx). The variant mirrors the shape of
// the screen it stands in for, so the swap to real content doesn't jump.
export function Rows() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <PageSkeleton title="Habits" />
    </div>
  );
}

export function Feed() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <PageSkeleton title="Feed" variant="feed" />
    </div>
  );
}

export function Friends() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <PageSkeleton title="Friends" variant="friends" />
    </div>
  );
}

export function Clock() {
  return (
    <div className="w-full" style={{ maxWidth: 390 }}>
      <PageSkeleton title="Clock in" variant="clock" />
    </div>
  );
}
