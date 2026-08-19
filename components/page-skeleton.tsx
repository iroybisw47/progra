import { cn } from "@/lib/utils";

// The first paint of every tab except the root route (which gets PrograLoader).
//
// Rebuilt in the editorial language on 2026-08-19: this file was the last thing
// drawing shadcn cards onto the redesigned tabs, so Clock/Feed/Friends/You each
// flashed a 3xl title over a stack of grey boxes and then re-laid out into flat
// hairline-split rows. The shapes below mirror the real screen instead — same
// pt-7/pb-28 frame, same max-w-md column, same 20px gutter, same row heights —
// so the swap reads as the content filling in rather than a second screen.
//
// The screen title stays real text, not a shimmer: it's the one thing already
// known at navigation time, and Next's loading.js guidance is to prerender the
// meaningful part (title, chrome) rather than blur everything.

type Variant = "feed" | "friends" | "profile" | "clock" | "rows";

// Shimmer fill. `bg-track` is the same pale grey the progress tracks use, so a
// loading screen never introduces a colour the design doesn't already have.
const PULSE = "bg-track animate-pulse motion-reduce:animate-none";

function Bar({
  w,
  h = 11,
  className,
}: {
  w: string;
  h?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(PULSE, "block shrink-0 rounded-full", className)}
      style={{ width: w, height: h }}
    />
  );
}

function Circle({ size }: { size: number }) {
  return (
    <span
      aria-hidden
      className={cn(PULSE, "block shrink-0 rounded-full")}
      style={{ width: size, height: size }}
    />
  );
}

// Chrome that is known before the data arrives — the search field, the
// clock-in inputs. Drawing it as an empty outline rather than a shimmer means
// those two land exactly where they already were, and only the unknown content
// pulses.
function Frame({ h, className }: { h: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "border-control-border block w-full rounded-[13px] border-[1.5px]",
        className
      )}
      style={{ height: h }}
    />
  );
}

function Block({ h, className }: { h: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(PULSE, "block w-full rounded-[13px]", className)}
      style={{ height: h }}
    />
  );
}

// A section eyebrow's placeholder: the 10px label slot, left where
// SectionHeader puts it.
function LabelBar({ className }: { className?: string }) {
  return <Bar w="54px" h={8} className={cn("rounded-[3px]", className)} />;
}

// Feed: SessionCard's frame — avatar + name/sub-line + timestamp, a serif
// title, sometimes a photo, then the duration pill and the kudos group.
function FeedBody() {
  const posts = [
    { title: "62%", desc: "88%", photo: false },
    { title: "47%", desc: null, photo: true },
    { title: "70%", desc: "54%", photo: false },
  ];
  return (
    <>
      {posts.map((p, i) => (
        <div
          key={i}
          className="border-hairline flex flex-col gap-[9px] border-b px-5 py-4"
        >
          <div className="flex items-center gap-[11px]">
            <Circle size={34} />
            <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
              <Bar w="38%" h={10} />
              <Bar w="64%" h={9} />
            </div>
            <Bar w="34px" h={9} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <Bar w={p.title} h={15} className="rounded-[5px]" />
            {p.desc && <Bar w={p.desc} h={10} />}
          </div>
          {p.photo && <Block h={190} className="rounded-[14px]" />}
          <div className="flex items-center gap-3.5 pt-0.5">
            <Bar w="66px" h={19} />
            <span className="flex-1" />
            <Bar w="88px" h={23} />
          </div>
        </div>
      ))}
    </>
  );
}

// Friends: the search field, then UserRow's divider-split rows (avatar, name
// over handle, an action chip hard right).
function FriendsBody() {
  return (
    <>
      <div className="px-5 pt-3.5">
        <Frame h={42} />
      </div>
      <div className="px-5 pt-[18px] pb-2">
        <LabelBar />
      </div>
      {["44%", "36%", "52%", "40%"].map((w, i) => (
        <div
          key={i}
          className="border-divider flex items-center gap-[11px] border-t px-5 py-[9px]"
        >
          <Circle size={36} />
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            <Bar w={w} h={10} />
            <Bar w="26%" h={9} />
          </div>
          <Bar w="58px" h={26} />
        </div>
      ))}
    </>
  );
}

// You: the identity block, the three serif stats, then the track-band splits
// that separate quotas from sessions.
function ProfileBody() {
  return (
    <>
      <div className="flex items-center gap-3.5 px-5 pt-4">
        <Circle size={58} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bar w="58%" h={18} className="rounded-[6px]" />
          <Bar w="32%" h={11} />
        </div>
      </div>

      <div className="flex px-5 pt-[18px]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-1 flex-col gap-2">
            <Bar w="46px" h={20} className="rounded-[6px]" />
            <Bar w="62px" h={9} />
          </div>
        ))}
      </div>

      <div className="bg-track border-hairline mt-5 h-1.5 border-t" />

      <div className="px-5 pt-[18px] pb-1">
        <LabelBar />
      </div>
      {["52%", "38%"].map((w, i) => (
        <div key={i} className="flex flex-col gap-2 px-5 py-2.5">
          <div className="flex items-center gap-3">
            <Bar w={w} h={11} />
            <span className="flex-1" />
            <Bar w="42px" h={9} />
          </div>
          <Block h={7} className="rounded-full" />
        </div>
      ))}

      <div className="bg-track border-hairline mt-3 h-1.5 border-t" />

      <div className="px-5 pt-[18px] pb-2">
        <LabelBar />
      </div>
      <ListRows widths={["58%", "44%", "66%"]} />
    </>
  );
}

// Clock: the clock-in form (name field, the two folding chips, the navy CTA),
// then the inset quiet zone with this week's bar and the day strip.
function ClockBody() {
  return (
    <>
      <div className="flex flex-col gap-2.5 px-5 pt-3">
        <Frame h={50} />
        <div className="flex gap-2">
          <Frame h={38} className="min-w-0 flex-1 rounded-xl" />
          <Frame h={38} className="min-w-0 flex-1 rounded-xl" />
        </div>
        {/* The CTA is the one navy element on the screen, so its placeholder is
            a navy tint — the button lands where the eye already went. */}
        <Block h={52} className="bg-brand/10 mt-1 rounded-[15px]" />
      </div>

      <div className="bg-inset border-hairline mt-6 border-t px-5 pb-4">
        <div className="flex items-center pt-5 pb-2.5">
          <LabelBar />
          <span className="flex-1" />
          <Bar w="64px" h={8} className="rounded-[3px]" />
        </div>
        <Bar w="92px" h={22} className="rounded-[6px]" />
        <div className="pt-3.5">
          <Block h={9} className="rounded-full" />
        </div>
        <div className="flex flex-col gap-2.5 pt-3">
          {["52%", "38%", "29%"].map((w, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <Circle size={9} />
              <Bar w={w} h={9} />
              <span className="flex-1" />
              <Bar w="34px" h={9} />
            </div>
          ))}
        </div>
        <div className="flex gap-1 pt-4">
          {Array.from({ length: 7 }, (_, i) => (
            <Block key={i} h={44} className="min-w-0 flex-1 rounded-[10px]" />
          ))}
        </div>
      </div>
    </>
  );
}

// The generic shape: divider-split rows with a title line, a sub-line and a
// right-aligned value. Used on its own for the screens that are lists (goals,
// habits, categories, sessions, recap) and inside the profile body.
function ListRows({ widths }: { widths: string[] }) {
  return (
    <>
      {widths.map((w, i) => (
        <div
          key={i}
          className="border-divider flex items-center gap-3 border-t px-5 py-3.5"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
            <Bar w={w} h={11} />
            <Bar w="28%" h={9} />
          </div>
          <Bar w="46px" h={13} className="rounded-[5px]" />
        </div>
      ))}
    </>
  );
}

function RowsBody({ rows }: { rows: number }) {
  const widths = ["56%", "42%", "68%", "37%", "60%", "48%"];
  return (
    <>
      <div className="px-5 pt-4 pb-2">
        <LabelBar />
      </div>
      <ListRows widths={widths.slice(0, rows)} />
    </>
  );
}

export function PageSkeleton({
  title,
  variant = "rows",
  rows = 4,
}: {
  title: string;
  variant?: Variant;
  // `rows` variant only: how many list rows to draw.
  rows?: number;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center pt-7 pb-28"
      role="status"
      aria-busy="true"
    >
      <main className="flex w-full max-w-md flex-col">
        <header className="flex items-center justify-between px-5">
          <span className="section-label">{title}</span>
          <span className="sr-only">Loading {title}…</span>
        </header>

        {variant === "feed" && <FeedBody />}
        {variant === "friends" && <FriendsBody />}
        {variant === "profile" && <ProfileBody />}
        {variant === "clock" && <ClockBody />}
        {variant === "rows" && <RowsBody rows={rows} />}
      </main>
    </div>
  );
}
