import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="Clock"
      subtitle="Track deep work in real time."
      blocks={3}
    />
  );
}
