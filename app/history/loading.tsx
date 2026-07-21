import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="History"
      subtitle="Where your time went."
      blocks={3}
    />
  );
}
