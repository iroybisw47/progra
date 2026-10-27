import { useState } from "react";
import { SessionPlanPicker } from "progra";

type Mode = "open" | "timed";
type Preset = "none" | "25/5" | "50/10";

function Picker({ initialMode, initialMinutes, initialPreset }: { initialMode: Mode; initialMinutes: number | null; initialPreset: Preset }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [minutes, setMinutes] = useState<number | null>(initialMinutes);
  const [preset, setPreset] = useState<Preset>(initialPreset);
  return (
    <div className="w-full px-5" style={{ maxWidth: 390 }}>
      <SessionPlanPicker
        mode={mode}
        onModeChange={setMode}
        plannedMinutes={minutes}
        onPlannedMinutesChange={setMinutes}
        breakPreset={preset}
        onBreakPresetChange={setPreset}
      />
    </div>
  );
}

// Clock-in mode chooser: "until I stop" vs a target with optional breaks.
export function OpenEnded() {
  return <Picker initialMode="open" initialMinutes={null} initialPreset="none" />;
}

export function TimedWithBreaks() {
  return <Picker initialMode="timed" initialMinutes={90} initialPreset="25/5" />;
}
