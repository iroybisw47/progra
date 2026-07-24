import { PrograLoader } from "@/components/progra-mark";

// Root route load (the Progress tab / first screen after sign-in): a branded
// clock loader — the mark's hands sweep while the page resolves.
export default function Loading() {
  return <PrograLoader />;
}
