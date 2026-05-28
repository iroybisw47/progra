import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Calendar"
      subtitle="Your scheduled time."
      blocks={1}
      showDayStrip
    />
  );
}
