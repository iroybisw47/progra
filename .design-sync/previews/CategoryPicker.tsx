import { CategoryPicker } from "progra";

// Same shape as lib/storage's Category (color comes from the 12-swatch
// palette; Errands is a colorless category so its dot is omitted).
const categories = [
  { id: "cat-deep-work", name: "Deep work", color: "#4f9b8c", rules: { titleContains: ["focus"] }, createdAt: 1749722400000 },
  { id: "cat-uni", name: "Uni", color: "#5f87c0", rules: { titleContains: ["lecture", "seminar"] }, createdAt: 1749722400000 },
  { id: "cat-gym", name: "Gym", color: "#c96f5e", rules: { titleContains: ["gym"] }, createdAt: 1749722400000 },
  { id: "cat-reading", name: "Reading", color: "#c7a23a", rules: {}, createdAt: 1749722400000 },
  { id: "cat-errands", name: "Errands", color: null, rules: {}, createdAt: 1749722400000 },
];

const noop = () => {};

export function WithSelection() {
  return (
    <div className="w-full max-w-sm">
      <CategoryPicker
        categories={categories}
        selectedId="cat-deep-work"
        onSelect={noop}
      />
    </div>
  );
}

export function NoSelection() {
  return (
    <div className="w-full max-w-sm">
      <CategoryPicker categories={categories} selectedId={null} onSelect={noop} />
    </div>
  );
}

export function Empty() {
  return (
    <div className="w-full max-w-sm">
      <CategoryPicker
        categories={[]}
        selectedId={null}
        onSelect={noop}
        emptyHint="Add categories on the clock screen first."
      />
    </div>
  );
}
