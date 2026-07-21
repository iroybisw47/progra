import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Categories"
      subtitle="How your time gets labeled."
      blocks={3}
    />
  );
}
