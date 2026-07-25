import { PrograLoader } from "@/components/progra-mark";

// The focused /history period views have no page header/skeleton to mirror, so
// show the branded clock loader (same as the root route) while data resolves.
export default function Loading() {
  return <PrograLoader />;
}
