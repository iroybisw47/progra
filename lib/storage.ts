export type Category = {
  id: string;
  name: string;
  createdAt: number;
};

export type Session = {
  id: string;
  categoryId: string | null;
  taskName: string;
  description?: string;
  startedAt: number;
  endedAt: number | null;
};

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  notes?: string;
  completedAt: number | null;
  createdAt: number;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
  createdAt: number;
};

const CATS_KEY = "progra.categories";
const SESS_KEY = "progra.sessions";
const TASKS_KEY = "progra.tasks";
const EVENTS_KEY = "progra.events";

function readArray<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or serialization failure — drop silently for v0.
  }
}

export function getCategories(): Category[] {
  return readArray<Category>(CATS_KEY);
}

export function saveCategories(categories: Category[]): void {
  writeArray(CATS_KEY, categories);
}

export function getSessions(): Session[] {
  return readArray<Session>(SESS_KEY);
}

export function saveSessions(sessions: Session[]): void {
  writeArray(SESS_KEY, sessions);
}

export function getActiveSession(): Session | null {
  return getSessions().find((s) => s.endedAt === null) ?? null;
}

export function getTasks(): Task[] {
  return readArray<Task>(TASKS_KEY);
}

export function saveTasks(tasks: Task[]): void {
  writeArray(TASKS_KEY, tasks);
}

export function getEvents(): CalendarEvent[] {
  return readArray<CalendarEvent>(EVENTS_KEY);
}

export function saveEvents(events: CalendarEvent[]): void {
  writeArray(EVENTS_KEY, events);
}
