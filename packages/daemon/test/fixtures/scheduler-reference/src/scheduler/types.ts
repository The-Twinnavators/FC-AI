export interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleInput = Pick<ScheduleEvent, "title" | "date" | "time" | "notes">;
