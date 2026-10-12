import { RecapGround } from "@/components/recap-story/recap-ground";
import { PrograLoader } from "@/components/progra-mark";
import { RECAP_V2 } from "@/lib/flags";

// The weekly review (RECAP_V2) opens on navy, so it loads on navy too.
export default function Loading() {
  return RECAP_V2 ? <RecapGround /> : <PrograLoader />;
}
