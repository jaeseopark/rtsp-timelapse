import "./app.css";
import { signal } from "@preact/signals";

export type Timelapse = {
  timelapse_id: string;
  created: number;
  updated: number;
  frames: number;
  interval: number;
  remaining: number;
};

export const timelapses = signal<Timelapse[]>([]);
