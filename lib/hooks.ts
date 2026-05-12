import { useSyncExternalStore } from "react";

import {
  type Category,
  type Session,
  getCategories,
  getSessions,
  saveCategories,
  saveSessions,
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

function getCategoriesSnap(): Category[] {
  if (categoriesCache === null) categoriesCache = getCategories();
  return categoriesCache;
}

function getSessionsSnap(): Session[] {
  if (sessionsCache === null) sessionsCache = getSessions();
  return sessionsCache;
}

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_SESSIONS: Session[] = [];

function getCategoriesServerSnap(): Category[] {
  return EMPTY_CATEGORIES;
}

function getSessionsServerSnap(): Session[] {
  return EMPTY_SESSIONS;
}

export function useCategories(): Category[] {
  return useSyncExternalStore(subscribeStorage, getCategoriesSnap, getCategoriesServerSnap);
}

export function useSessions(): Session[] {
  return useSyncExternalStore(subscribeStorage, getSessionsSnap, getSessionsServerSnap);
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
