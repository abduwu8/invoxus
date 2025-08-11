import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Provide a TypeScript declaration when consumed from TS files
// eslint-disable-next-line @typescript-eslint/no-unused-vars
/**
 * @typedef {(…inputs: any[]) => string} Cn
 */

// TypeScript support declaration (ambient) for TS consumers
// eslint-disable-next-line @typescript-eslint/no-unused-vars
/**
 * @typedef {(cls?: any) => string} Cn
 */