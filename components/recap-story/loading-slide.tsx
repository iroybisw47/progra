import Image from "next/image";

import { anim, EASE } from "@/lib/recap-story-nav";

const LOGO = "/progra-logo-336.png";

// 00 · Loading. The app icon's clock face fills clockwise from 12 (a conic
// mask on a full-colour copy over a grey ghost), the ghost resolves to colour
// as the sweep closes, the tile settles, and the date line rises. The story
// advances on its own at INTRO_MS — the only slide that does.
export function LoadingSlide({ weekOfLabel }: { weekOfLabel: string }) {
  return (
    <section
      aria-label="Your week in review"
      className="bg-brand-deep absolute inset-0 flex flex-col items-center justify-center gap-6 pb-5"
    >
      <div
        className="relative size-28 overflow-hidden rounded-[25px]"
        style={{ animation: `${anim("scale", 0.5)}, rc-settle .45s ease-in-out 1.65s` }}
      >
        <Image
          src={LOGO}
          alt=""
          width={112}
          height={112}
          unoptimized
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 block size-full"
          style={{ opacity: 0.2, filter: "grayscale(1)", animation: anim("unghost", 0.2, 1.6, "ease") }}
        />
        <Image
          src={LOGO}
          alt="Progra"
          width={112}
          height={112}
          unoptimized
          loading="eager"
          className="absolute inset-0 block size-full"
          style={{
            WebkitMaskImage: "conic-gradient(#000 var(--rc-sweep), transparent 0)",
            maskImage: "conic-gradient(#000 var(--rc-sweep), transparent 0)",
            animation: anim("sweep", 1.5, 0.15, EASE.inOut),
          }}
        />
      </div>
      <span
        className="text-[13px] font-medium tracking-[.01em] whitespace-nowrap text-white/62"
        style={{ animation: anim("rise", 0.45, 0.35) }}
      >
        {weekOfLabel}
      </span>
    </section>
  );
}

// The Loading screen again, finished, sliding up off the Hours slide that
// mounted beneath it — only on the step from Loading, never on a way back.
export function IntroCurtain({ weekOfLabel }: { weekOfLabel: string }) {
  return (
    <div
      aria-hidden
      className="bg-brand-deep pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center gap-6 pb-5"
      style={{ animation: anim("curtain", 0.8, 0.05, EASE.curtain) }}
    >
      <Image
        src={LOGO}
        alt=""
        width={112}
        height={112}
        unoptimized
        className="block size-28 rounded-[25px]"
      />
      <span className="text-[13px] font-medium tracking-[.01em] whitespace-nowrap text-white/62">
        {weekOfLabel}
      </span>
    </div>
  );
}
