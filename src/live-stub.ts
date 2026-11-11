import { Hono } from "hono";
import type { Verdict } from "./types.js";

export interface LiveCheck {
  at: string;
  amount: string;
  receipt_id: string;
  verdict: Verdict;
}

export async function recordCheck(_c: LiveCheck): Promise<void> {}

export const live = new Hono();
