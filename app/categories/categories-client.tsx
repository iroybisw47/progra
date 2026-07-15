"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ColorSwatches } from "@/components/color-swatches";
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/app/actions/categories";
import type { Category } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { BackLink } from "@/components/v2/back-link";

type Result = { ok: true } | { error: string; code?: "duplicate" };

type Editing =
  | { mode: "new" }
  | { mode: "edit"; category: Category }
  | null;

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<Editing>(null);

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwDraft, setKwDraft] = useState("");

  function openNew() {
    setName("");
    setColor(null);
    setKeywords([]);
    setKwDraft("");
    setEditing({ mode: "new" });
  }

  function openEdit(category: Category) {
    setName(category.name);
    setColor(category.color);
    setKeywords(category.rules.titleContains ?? []);
    setKwDraft("");
    setEditing({ mode: "edit", category });
  }

  function addKeyword() {
    const v = kwDraft.trim();
    if (!v) return;
    if (!keywords.some((k) => k.toLowerCase() === v.toLowerCase())) {
      setKeywords((ks) => [...ks, v]);
    }
    setKwDraft("");
  }

  function run(action: () => Promise<Result>, okMsg: string) {
    startTransition(async () => {
      const r = await action();
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(okMsg);
      setEditing(null);
      router.refresh();
    });
  }

  function save() {
    if (!name.trim()) {
      toast.error("Name required");
      return;
    }
    if (editing?.mode === "edit") {
      const id = editing.category.id;
      run(() => updateCategory(id, { name, color, keywords }), "Saved");
    } else {
      run(() => createCategory(name, { color, keywords }), "Category added");
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center px-5 pt-8 pb-28">
      <main className="flex w-full max-w-md flex-col gap-4">
        <BackLink />
        <header className="flex items-center justify-between">
          <h1 className="text-[26px] font-bold tracking-tight">Categories</h1>
          <Button size="sm" onClick={openNew}>
            <PlusIcon className="size-4" /> New
          </Button>
        </header>

        {categories.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-caption text-center text-sm">
                No categories yet. Add one to sort your tracked time and
                auto-classify calendar events by keyword.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col py-1">
              {categories.map((c, i) => {
                const kws = c.rules.titleContains ?? [];
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openEdit(c)}
                    className={cn(
                      "flex items-center gap-3 py-3 text-left",
                      i > 0 && "border-divider border-t"
                    )}
                  >
                    <span
                      className="size-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color ?? "var(--faint)" }}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{c.name}</span>
                      {kws.length > 0 && (
                        <span className="text-caption truncate font-mono text-xs">
                          {kws.join(" · ")}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        <p className="text-caption px-1 text-xs">
          Keyword rules auto-classify imported calendar events. Precedence: a
          manual override beats a keyword rule beats an AI guess.
        </p>
      </main>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === "edit" ? "Edit category" : "New category"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Name</span>
              <Input
                className="h-10"
                placeholder="e.g. Work"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Color</span>
              <ColorSwatches value={color} onChange={setColor} />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Keyword rules</span>
              <div className="flex gap-2">
                <Input
                  className="h-10"
                  placeholder="Add a keyword…"
                  value={kwDraft}
                  onChange={(e) => setKwDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 shrink-0"
                  onClick={addKeyword}
                >
                  Add
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {keywords.map((k) => (
                    <span
                      key={k}
                      className="bg-track text-body inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs"
                    >
                      {k}
                      <button
                        type="button"
                        aria-label={`Remove ${k}`}
                        onClick={() =>
                          setKeywords((ks) => ks.filter((x) => x !== k))
                        }
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            {editing?.mode === "edit" ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="ghost" className="text-destructive">
                      Delete
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this category?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sessions in it become uncategorized. This can&rsquo;t be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        run(
                          () => deleteCategory(editing.category.id),
                          "Category deleted"
                        )
                      }
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setEditing(null)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={save} disabled={pending}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
