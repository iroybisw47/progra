import { CHIP, CHIP_OFF, CHIP_ON, ChipRail } from "progra";

// The Today / Week / History segmented switcher at the top of Progress.
// Selected chip is solid navy; the rest are faint uppercase text on the track.
export function TodaySelected() {
  // The rail hugs its chips; in the app it always sits in a flex row.
  return (
    <div className="flex">
      <ChipRail>
        <button type="button" className={`${CHIP} ${CHIP_ON}`}>Today</button>
        <button type="button" className={`${CHIP} ${CHIP_OFF}`}>Week</button>
        <button type="button" className={`${CHIP} ${CHIP_OFF}`}>History</button>
      </ChipRail>
    </div>
  );
}

export function WeekSelected() {
  // The rail hugs its chips; in the app it always sits in a flex row.
  return (
    <div className="flex">
      <ChipRail>
        <button type="button" className={`${CHIP} ${CHIP_OFF}`}>Today</button>
        <button type="button" className={`${CHIP} ${CHIP_ON}`}>Week</button>
        <button type="button" className={`${CHIP} ${CHIP_OFF}`}>History</button>
      </ChipRail>
    </div>
  );
}

// As it sits on Progress: eyebrow date on the left, rail on the right.
export function InHeader() {
  return (
    <div className="flex w-full items-center justify-between gap-3 px-5" style={{ maxWidth: 390 }}>
      <span className="section-label whitespace-nowrap">Thu, Oct 8</span>
      <ChipRail>
        <button type="button" className={`${CHIP} ${CHIP_ON}`}>Today</button>
        <button type="button" className={`${CHIP} ${CHIP_OFF}`}>Week</button>
        <button type="button" className={`${CHIP} ${CHIP_OFF}`}>History</button>
      </ChipRail>
    </div>
  );
}
