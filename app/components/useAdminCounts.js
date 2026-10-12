"use client";

import { useCallback, useEffect, useState } from "react";

// Root's "waiting" counts (account requests, password requests, Staff ID changes)
// are kept in this browser and checked again at most once a day, to keep the load
// on the server low. They are refreshed sooner when Root opens an Admin page
// (those pages read live numbers) or presses "Refresh counts" in the user menu.
const KEY = "hse-admin-counts";
const EVENT = "hse-admin-counts";
const DAY = 24 * 60 * 60 * 1000;

function read() {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (v && v.counts && typeof v.at === "number") return v;
  } catch (e) {
    // Unreadable or blocked storage: treat as nothing saved.
  }
  return null;
}

export function storeCounts(counts) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), counts }));
  } catch (e) {
    // Storage blocked: the menu just checks again next time.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function clearCounts() {
  try {
    window.localStorage.removeItem(KEY);
  } catch (e) {
    // Nothing to clear.
  }
}

export function useAdminCounts(enabled) {
  const [saved, setSaved] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | failed

  const refresh = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetch("/api/admin/counts", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      storeCounts(await res.json());
      setState("idle");
    } catch (e) {
      setState("failed");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const load = () => setSaved(read());
    load();
    const first = read();
    if (!first || Date.now() - first.at > DAY) refresh();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [enabled, refresh]);

  return { counts: saved ? saved.counts : null, checkedAt: saved ? saved.at : null, state, refresh };
}
