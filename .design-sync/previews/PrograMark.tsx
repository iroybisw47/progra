import { PrograLoader, PrograMark } from "progra";

export function Mark() {
  return <PrograMark size={58} />;
}

export function Small() {
  return <PrograMark size={32} />;
}

// Route-level loading state: the mark with sweeping hands.
export function Loader() {
  return (
    <div style={{ width: 320, height: 200 }} className="flex items-center justify-center">
      <PrograLoader label="Loading your week" />
    </div>
  );
}
