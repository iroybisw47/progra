import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Progra"
      subtitle="Where your week is going."
      blocks={3}
    />
  );
}
