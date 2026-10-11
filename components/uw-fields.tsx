"use client";

import { useId, useRef } from "react";

import { ChipField } from "@/components/v2/chip-field";
import { ToggleSwitch } from "@/components/v2/toggle-switch";
import {
  UW_INTEREST_FIELD,
  UW_LEAVING_NOTE,
  UW_LISTED_DISCLOSURE,
  UW_LISTED_LABEL,
  UW_MAJOR_FIELD,
  UW_UNLISTED_NOTE,
  type UwBlockState,
} from "@/lib/uw-fields";

// The Settings UW block (plan P9b), at the foot of Edit profile: whether
// you're a UW student, and when you are, your majors and interests on the
// shared chip field (components/v2/chip-field.tsx) and the switch that lists
// you to other UW students (D2). Rendered only while UW is on.
//
// Controlled, and saved by the sheet's own Save (lib/uw-fields.ts'
// saveUwBlock), not as each thing changes. A UW switch that saved on the tap
// would clear a student's majors and interests on one mis-tap, since leaving
// takes everything with it, and a chip field that saved per chip would lose
// whatever was typed but never Returned. Here the switch can go off and back
// on with nothing lost, and the Save commits typed drafts.
//
// The fields' limits, lists and copy are lib/uw-fields.ts', the same ones
// Screen 1's quick-add uses (P9c). The goal-sharing tile that used to sit
// where the listing switch is went with D3: goal titles are no longer shared
// with UW students at all.
export function UwFields({
  value,
  onChange,
  savedIsUw,
  disabled,
}: {
  value: UwBlockState;
  onChange: (next: UwBlockState) => void;
  // Whether the saved profile is in the cohort, so switching off can say
  // what a Save would then clear.
  savedIsUw: boolean;
  // While Edit profile's Save is in flight.
  disabled?: boolean;
}) {
  const interestsRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const leavingId = `${id}-leaving`;
  const disclosureId = `${id}-disclosure`;
  const leaving = !value.isUw && savedIsUw;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <SwitchRow
          label="I'm a UW student"
          checked={value.isUw}
          disabled={disabled}
          describedBy={leaving ? leavingId : undefined}
          onCheckedChange={(isUw) => onChange({ ...value, isUw })}
        />
        {/* A live region that's always there, so the warning is read out as
            the switch goes off, not only if someone goes looking for it. */}
        <div aria-live="polite">
          {leaving && <Caption id={leavingId}>{UW_LEAVING_NOTE}</Caption>}
        </div>
      </div>

      {value.isUw && (
        <>
          <ChipField
            {...UW_MAJOR_FIELD}
            value={value.majors}
            onChange={(majors) => onChange({ ...value, majors })}
            // Return on an empty major moves on to interests (R:85). Not
            // preventScroll: in the sheet the field can be below the fold.
            // With interests full there's no input to go to, so it closes the
            // keyboard instead, as Return on the last field does.
            onEmptyReturn={(input) => {
              if (interestsRef.current) interestsRef.current.focus();
              else input.blur();
            }}
            disabled={disabled}
          />
          <ChipField
            {...UW_INTEREST_FIELD}
            inputRef={interestsRef}
            value={value.interests}
            onChange={(interests) => onChange({ ...value, interests })}
            // The last field: Return on nothing closes the keyboard.
            onEmptyReturn={(input) => input.blur()}
            disabled={disabled}
          />
          <div className="flex flex-col gap-1.5">
            {/* The disclosure is the switch's description, so a screen
                reader hears what it exposes before turning it on. */}
            <SwitchRow
              label={UW_LISTED_LABEL}
              checked={value.listed}
              disabled={disabled}
              describedBy={disclosureId}
              onCheckedChange={(listed) => onChange({ ...value, listed })}
            />
            <Caption id={disclosureId}>
              {UW_LISTED_DISCLOSURE} {UW_UNLISTED_NOTE}
            </Caption>
          </div>
        </>
      )}
    </div>
  );
}

// The sheet's switch row: the label, then the 44×26 switch. The label is a
// real <label> for the switch, so tapping the words flips it too, and it is
// the switch's name, so what a screen reader or Voice Control says matches
// what's on screen.
function SwitchRow({
  label,
  checked,
  disabled,
  describedBy,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  describedBy?: string;
  onCheckedChange: (next: boolean) => void;
}) {
  const id = useId();
  const switchId = `${id}-switch`;
  const labelId = `${id}-label`;
  return (
    <div className="flex items-center gap-3">
      <label
        id={labelId}
        htmlFor={switchId}
        className="text-body min-w-0 flex-1 text-[13.5px] font-medium"
      >
        {label}
      </label>
      <ToggleSwitch
        id={switchId}
        labelledBy={labelId}
        describedBy={describedBy}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function Caption({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-caption text-[11px] leading-snug text-pretty">
      {children}
    </p>
  );
}
