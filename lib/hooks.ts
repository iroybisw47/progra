import { useSyncExternalStore } from "react";

import {
  type CalendarEvent,
  type Category,
  type Session,
  type Task,
  getCategories,
  getEvents,
  getSessions,
  getTasks,
  saveCategories,
  saveEvents,
  saveSessions,
  saveTasks,
} from "./storage";

const listeners = new Set<() => void>();

function subscribeStorage(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

let categoriesCache: Category[] | null = null;
let sessionsCache: Session[] | null = null;
let tasksCache: Task[] | null = null;
let eventsCache: CalendarEvent[] | null = null;

function getCategoriesSnap(): Category[] {
  if (categoriesCache === null) categoriesCache = getCategories();
  return categoriesCache;
}

function getSessionsSnap(): Session[] {
  if (sessionsCache === null) sessionsCache = getSessions();
  return sessionsCache;
}

function getTasksSnap(): Task[] {
  if (tasksCache === null) tasksCache = getTasks();
  return tasksCache;
}

function getEventsSnap(): CalendarEvent[] {
  if (eventsCache === null) eventsCache = getEvents();
  return eventsCache;
}

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_SESSIONS: Session[] = [];
const EMPTY_TASKS: Task[] = [];
const EMPTY_EVENTS: CalendarEvent[] = [];

function getCategoriesServerSnap(): Category[] {
  return EMPTY_CATEGORIES;
}

function getSessionsServerSnap(): Session[] {
  return EMPTY_SESSIONS;
}

function getTasksServerSnap(): Task[] {
  return EMPTY_TASKS;
}

function getEventsServerSnap(): CalendarEvent[] {
  return EMPTY_EVENTS;
}

export function useCategories(): Category[] {
  return useSyncExternalStore(subscribeStorage, getCategoriesSnap, getCategoriesServerSnap);
}

export function useSessions(): Session[] {
  return useSyncExternalStore(subscribeStorage, getSessionsSnap, getSessionsServerSnap);
}

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribeStorage, getTasksSnap, getTasksServerSnap);
}

export function useEvents(): CalendarEvent[] {
  return useSyncExternalStore(subscribeStorage, getEventsSnap, getEventsServerSnap);
}

export function updateCategories(next: Category[]): void {
  categoriesCache = next;
  saveCategories(next);
  notify();
}

export function updateSessions(next: Session[]): void {
  sessionsCache = next;
  saveSessions(next);
  notify();
}

export function updateTasks(next: Task[]): void {
  tasksCache = next;
  saveTasks(next);
  notify();
}

export function updateEvents(next: CalendarEvent[]): void {
  eventsCache = next;
  saveEvents(next);
  notify();
}

let cachedNow: number | null = null;

function subscribeNow(cb: () => void): () => void {
  cachedNow = Date.now();
  cb();
  const id = setInterval(() => {
    cachedNow = Date.now();
    cb();
  }, 1000);
  return () => clearInterval(id);
}

function getNowSnap(): number {
  if (cachedNow === null) cachedNow = Date.now();
  return cachedNow;
}

function getNowServerSnap(): number {
  return 0;
}

export function useNow(): number {
  return useSyncExternalStore(subscribeNow, getNowSnap, getNowServerSnap);
}
