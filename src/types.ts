export type Role = 'admin' | 'member';

export interface AppSettings {
  memberAnalysisAllowedUserIds: string[]; // メンバー分析を閲覧できる一般ユーザーのIDリスト（管理者は常に閲覧可）
}

export interface NotificationSettings {
  weeklyEnabled: boolean;
  weeklyDayOfWeek: number; // 0=日..6=土 (default: 2=火)
  weeklyHour: number;      // 0-23 (default: 10)
  weeklyMinute: number;    // 0-59 (default: 0)
  dailyEnabled: boolean;
  dailyHour: number;       // 0-23 (default: 9)
  dailyMinute: number;     // 0-59 (default: 30)
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  visibleCategoryIds?: string[];
  notificationSettings?: NotificationSettings;
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
  description?: string; // メモ・詳細
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

export interface PersonalSchedule {
  id: string;
  title: string;
  memo?: string; // メモ、オンラインMTG URL 等
  color?: string; // カスタムカラー（タスク連携・確定日程は色固定のため使用しない）
  createdBy: string;
  createdAt: string;
  participantIds: string[]; // 作成者を含む
  startDateTime: string; // ISO string
  endDateTime: string;   // ISO string
  taskId?: string;       // 連携タスクID
  isArchived?: boolean;
  archivedAt?: string;
}

export type VoteStatus = 'ok' | 'fair' | 'ng' | 'none';

export interface MeetingPoll {
  id: string;
  title: string;
  description?: string;
  memo?: string; // 確定後のメモ（スケジューラー上で編集可能）
  createdBy: string;
  createdAt: string;
  targetUserIds: string[];
  options: string[]; // e.g., "2024/04/10 10:00-11:00"
  votes: Record<string, Record<string, VoteStatus>>; // userId -> option -> status
  isDeleted?: boolean;
  deletedAt?: string;
  confirmedOption?: string; // e.g., "2024/04/10 10:00-11:00"
  confirmedAt?: string;
  confirmedBy?: string;
}
