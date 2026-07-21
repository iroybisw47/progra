import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Friends"
      subtitle="Your people on Progra."
      blocks={3}
    />
  );
}
