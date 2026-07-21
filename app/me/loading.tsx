import { PageSkeleton } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <PageSkeleton
      title="You"
      subtitle="Your profile and this week."
      blocks={3}
    />
  );
}
