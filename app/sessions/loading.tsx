import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Session history"
      subtitle="Past clocked-in sessions."
      blocks={3}
    />
  );
}
