import { GoalProgressBar } from "progra";

const H = 60 * 60 * 1000;

export function OnTrack() {
  return (
    <div className="w-full max-w-sm">
      <GoalProgressBar title="Thesis" quotaHours={10} actualMs={7.5 * H} />
    </div>
  );
}

export function OverQuota() {
  return (
    <div className="w-full max-w-sm">
      <GoalProgressBar title="Gym" quotaHours={4} actualMs={5.5 * H} />
    </div>
  );
}

export function NoQuota() {
  return (
    <div className="w-full max-w-sm">
      <GoalProgressBar title="Reading" quotaHours={0} actualMs={3.2 * H} />
    </div>
  );
}

// The "Goals this week" card body on home stacks several bars.
export function Stacked() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <GoalProgressBar title="Thesis" quotaHours={10} actualMs={7.5 * H} />
      <GoalProgressBar title="Spanish" quotaHours={3} actualMs={2.5 * H} />
      <GoalProgressBar title="Gym" quotaHours={4} actualMs={0.5 * H} />
    </div>
  );
}
