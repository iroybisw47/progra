"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { type Session } from "@/lib/storage";
import { formatDuration } from "@/lib/duration";
import {
  formatLocalDate,
  formatRelativeDay,
  formatTime,
} from "@/lib/dates";

type SessionRowProps = {
  session: Session;
  categoryName: string;
  now: Date;
  onEdit: () => void;
  onDelete: () => void;
};

export function SessionRow({
  session,
  categoryName,
  now,
  onEdit,
  onDelete,
}: SessionRowProps) {
  const startedAt = new Date(session.startedAt);
  const endedAt = new Date(session.endedAt ?? session.startedAt);
  const sameDay = formatLocalDate(startedAt) === formatLocalDate(endedAt);
  const dayLabel = formatRelativeDay(startedAt, now);
  const timeRange = sameDay
    ? `${formatTime(startedAt)}–${formatTime(endedAt)}`
    : `${formatTime(startedAt)} – ${formatRelativeDay(endedAt, now)} ${formatTime(endedAt)}`;

  const durationMs = (session.endedAt ?? session.startedAt) - session.startedAt;

  return (
    <Card
      size="sm"
      onClick={onEdit}
      className="group/session cursor-pointer transition-colors hover:bg-muted/40"
    >
      <div className="flex flex-col gap-1 px-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium truncate">{session.taskName}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground shrink-0">
            {formatDuration(durationMs)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="h-5">{categoryName}</Badge>
          <span className="font-mono tabular-nums">
            {dayLabel}, {timeRange}
          </span>
        </div>
        {session.description && (
          <p className="text-xs text-muted-foreground truncate">
            {session.description}
          </p>
        )}
        <div className="flex justify-end gap-1 pt-1">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Edit session"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <PencilIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete session"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
    </Card>
  );
}
