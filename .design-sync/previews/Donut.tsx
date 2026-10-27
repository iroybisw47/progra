import { Donut } from "progra";

const segs = [
  { color: "#395AA0", value: 7.5 },
  { color: "#E07042", value: 2.5 },
  { color: "#2E8B50", value: 4 },
  { color: "#D6A728", value: 1.5 },
];

// Thin ring (Progress → Week): size 150, stroke 14.
export function Thin() {
  return <Donut segments={segs} label="15.5h" sub="This week" />;
}

// Big Today donut with a larger center label.
export function Large() {
  return (
    <Donut segments={segs.slice(0, 3)} size={180} stroke={20} label="3h 45m" labelClassName="text-2xl" sub="Today" />
  );
}

// Thick donut-pie (History).
export function Thick() {
  return <Donut segments={segs} size={150} stroke={40} />;
}

// Nothing tracked: bare track ring.
export function Empty() {
  return <Donut segments={[]} label="0m" sub="Today" />;
}
