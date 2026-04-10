export type Role = 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  visibleCategoryIds?: string[];
}

export interface Category {
  id: string;
  name: string;
  isAdminOnly: boolean;
}

export interface Initiative {
  id: string;
  title: string;
  categoryId: string;
  assigneeIds?: string[];
  assigneeId?: string; // deprecated
  isArchived: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
  completedBy?: string;
  completedAt?: string;
}

export type RecurrenceType = 'none' | 'weekly' | 'monthly_date' | 'monthly_week';

export interface Task {
  id: string;
  initiativeId: string;
  title: string;
  description?: string;
  assigneeIds?: string[];
  assigneeId?: string; // deprecated
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isCompleted: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  readStatus?: Record<string, string>; // userId -> lastReadAt (ISO string)
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
  completedBy?: string;
  completedAt?: string;
  // Recurring task fields (new single-task recurring approach)
  recurringType?: RecurrenceType;
  recurringDaysOfWeek?: number[];      // for 'weekly': 0=Sun..6=Sat
  recurringDatesOfMonth?: number[];    // for 'monthly_date': 1-31
  recurringWeekOfMonth?: number;       // for 'monthly_week': 1-5 (5=last)
  recurringDayOfWeekMonthly?: number;  // for 'monthly_week': 0-6
  recurringEndDate?: string;           // YYYY-MM-DD: when recurrence stops
  recurringDuration?: number;          // duration in days for each period
  // Deprecated: used only for old multi-task recurring approach
  recurringGroupId?: string;
}

export interface TaskMemo {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export type VoteStatus = 'ok' | 'fair' | 'ng' | 'none';

export interface MeetingPoll {
  id: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  targetUserIds: string[];
  options: string[]; // e.g., "4/10 10:00-11:00"
  votes: Record<string, Record<string, VoteStatus>>; // userId -> option -> status
  isDeleted?: boolean;
  deletedAt?: string;
}
