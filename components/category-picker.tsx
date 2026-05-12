"use client";

import { Badge } from "@/components/ui/badge";
import { type Category } from "@/lib/storage";

type CategoryPickerProps = {
  categories: Category[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyHint?: string;
};

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  emptyHint = "Add a category below to get started.",
}: CategoryPickerProps) {
  if (categories.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyHint}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <Badge
          key={cat.id}
          variant={selectedId === cat.id ? "default" : "outline"}
          className="h-8 cursor-pointer px-3 text-sm"
          render={
            <button
              type="button"
              aria-pressed={selectedId === cat.id}
              onClick={() => onSelect(cat.id)}
            />
          }
        >
          {cat.name}
        </Badge>
      ))}
    </div>
  );
}
