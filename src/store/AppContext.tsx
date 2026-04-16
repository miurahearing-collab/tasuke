import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Category, Initiative, Task, TaskMemo, User, Role, MeetingPoll, VoteStatus, RecurrenceType, PersonalSchedule, NotificationSettings, AppSettings } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, getDoc, deleteField, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { addDays, format, parseISO, startOfDay, startOfWeek, endOfWeek } from 'date-fns';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  weeklyEnabled: true,
  weeklyDayOfWeek: 2, // 火曜日
  weeklyHour: 10,
  weeklyMinute: 0,
  dailyEnabled: true,
  dailyHour: 9,
  dailyMinute: 30,
};

// ---- Recurring period calculation ----

function getNthDayOfMonth(year: number, month: number, weekOfMonth: number, dayOfWeek: number): Date | null {
  if (weekOfMonth === 5) {
    // Last occurrence
    const lastDay = new Date(year, month + 1, 0);
    let d = lastDay;
    while (d.getDay() !== dayOfWeek) {
      d = addDays(d, -1);
    }
    return d;
  }
  let count = 0;
  let d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === dayOfWeek) {
      count++;
      if (count === weekOfMonth) return d;
    }
    d = addDays(d, 1);
  }
  return null;
}

function getCurrentRecurringPeriod(task: Task, today: Date): { startDate: string; endDate: string } | null {
  if (!task.recurringType || task.recurringType === 'none') return null;

  const duration = task.recurringDuration ?? 0;
  if (task.recurringEndDate && today > startOfDay(parseISO(task.recurringEndDate))) return null;

  if (task.recurringType === 'weekly') {
    const days = task.recurringDaysOfWeek?.length ? task.recurringDaysOfWeek : [parseISO(task.startDate).getDay()];
    for (let i = 0; i <= 6; i++) {
      const candidate = addDays(today, -i);
      if (days.includes(candidate.getDay())) {
        return {
          startDate: format(candidate, 'yyyy-MM-dd'),
          endDate: format(addDays(candidate, duration), 'yyyy-MM-dd'),
        };
      }
    }
    return null;
  }

  if (task.recurringType === 'monthly_date') {
    const dates = task.recurringDatesOfMonth?.length ? task.recurringDatesOfMonth : [parseISO(task.startDate).getDate()];
    let bestDate: Date | null = null;
    for (let mo = 0; mo >= -1; mo--) {
      for (const d of dates) {
        const candidate = new Date(today.getFullYear(), today.getMonth() + mo, d);
        if (candidate <= today && (!bestDate || candidate > bestDate)) {
          bestDate = candidate;
        }
      }
    }
    if (!bestDate) return null;
    return {
      startDate: format(bestDate, 'yyyy-MM-dd'),
      endDate: format(addDays(bestDate, duration), 'yyyy-MM-dd'),
    };
  }

  if (task.recurringType === 'monthly_week') {
    const weekOfMonth = task.recurringWeekOfMonth ?? 1;
    const dayOfWeek = task.recurringDayOfWeekMonthly ?? 1;
    let bestDate: Date | null = null;
    for (let mo = 0; mo >= -1; mo--) {
      const candidate = getNthDayOfMonth(today.getFullYear(), today.getMonth() + mo, weekOfMonth, dayOfWeek);
      if (candidate && candidate <= today && (!bestDate || candidate > bestDate)) {
        bestDate = candidate;
      }
    }
    if (!bestDate) return null;
    return {
      startDate: format(bestDate, 'yyyy-MM-dd'),
      endDate: format(addDays(bestDate, duration), 'yyyy-MM-dd'),
    };
  }

  return null;
}

// ---- Context types ----

interface RecurringOptions {
  recurringType: RecurrenceType;
  recurringDaysOfWeek?: number[];
  recurringDatesOfMonth?: number[];
  recurringWeekOfMonth?: number;
  recurringDayOfWeekMonthly?: number;
  recurringEndDate?: string;
  recurringDuration?: number;
}

interface AppContextType {
  currentUser: User | null;
  users: User[];
  categories: Category[];
  initiatives: Initiative[];
  deletedInitiatives: Initiative[];
  tasks: Task[];
  deletedTasks: Task[];
  memos: TaskMemo[];
  meetingPolls: MeetingPoll[];
  addCategory: (name: string, isAdminOnly: boolean) => Promise<void>;
  updateCategory: (id: string, name: string, isAdminOnly: boolean) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addInitiative: (title: string, categoryId: string, assigneeIds?: string[], description?: string) => Promise<void>;
  updateInitiative: (id: string, title: string, categoryId: string, assigneeIds?: string[], description?: string) => Promise<void>;
  archiveInitiative: (id: string) => Promise<void>;
  unarchiveInitiative: (id: string) => Promise<void>;
  deleteInitiative: (id: string) => Promise<void>;
  restoreInitiative: (id: string) => Promise<void>;
  permanentDeleteInitiative: (id: string) => Promise<void>;
  addTask: (initiativeId: string, title: string, startDate: string, endDate: string, assigneeIds?: string[], recurringOptions?: RecurringOptions) => Promise<void>;
  addTasks: (tasksData: { initiativeId: string, title: string, startDate: string, endDate: string, assigneeIds: string[], recurringGroupId?: string }[]) => Promise<void>;
  updateTask: (taskId: string, title: string, startDate: string, endDate: string, assigneeIds?: string[]) => Promise<void>;
  toggleTaskCompletion: (id: string) => Promise<void>;
  updateTaskDescription: (taskId: string, description: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  restoreTask: (id: string) => Promise<void>;
  permanentDeleteTask: (id: string) => Promise<void>;
  addMemo: (taskId: string, content: string) => Promise<void>;
  deleteMemo: (memoId: string) => Promise<void>;
  markTaskAsRead: (taskId: string) => Promise<void>;
  addMeetingPoll: (title: string, description: string, targetUserIds: string[], options: string[]) => Promise<void>;
  voteMeetingPoll: (pollId: string, option: string, status: VoteStatus) => Promise<void>;
  updateMeetingPoll: (pollId: string, title: string, description: string, targetUserIds: string[], options: string[]) => Promise<void>;
  moveToTrashMeetingPoll: (pollId: string) => Promise<void>;
  restoreMeetingPoll: (pollId: string) => Promise<void>;
  deleteMeetingPoll: (pollId: string) => Promise<void>;
  confirmMeetingPoll: (pollId: string, option: string) => Promise<void>;
  cancelConfirmMeetingPoll: (pollId: string) => Promise<void>;
  updateMeetingPollMemo: (pollId: string, memo: string) => Promise<void>;
  personalSchedules: PersonalSchedule[];
  archivedSchedules: PersonalSchedule[];
  addPersonalSchedule: (data: { title: string; memo?: string; color?: string; participantIds: string[]; startDateTime: string; endDateTime: string; taskId?: string }) => Promise<void>;
  updatePersonalSchedule: (id: string, data: { title?: string; memo?: string; color?: string; participantIds?: string[]; startDateTime?: string; endDateTime?: string }) => Promise<void>;
  archivePersonalSchedule: (id: string) => Promise<void>;
  permanentDeletePersonalSchedule: (id: string) => Promise<void>;
  bulkPermanentDeletePersonalSchedules: (ids: string[]) => Promise<void>;
  updateUser: (userId: string, name: string, role: Role, visibleCategoryIds?: string[]) => Promise<void>;
  appSettings: AppSettings;
  updateAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  notificationSettings: NotificationSettings;
  updateNotificationSettings: (settings: NotificationSettings) => Promise<void>;
  requestNotificationPermission: () => Promise<NotificationPermission | null>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allInitiatives, setAllInitiatives] = useState<Initiative[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [memos, setMemos] = useState<TaskMemo[]>([]);
  const [meetingPolls, setMeetingPolls] = useState<MeetingPoll[]>([]);
  const [allPersonalSchedules, setAllPersonalSchedules] = useState<PersonalSchedule[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ memberAnalysisAllowedUserIds: [] });
  const [isAuthReady, setIsAuthReady] = useState(false);
  // 繰り返しタスクリセット：セッション内で1回だけ実行するフラグ
  const recurringResetDoneRef = useRef(false);

  const categories = React.useMemo(() => {
    if (currentUser?.role === 'admin' || !currentUser?.visibleCategoryIds) return allCategories;
    return allCategories.filter(c => currentUser.visibleCategoryIds!.includes(c.id));
  }, [allCategories, currentUser]);

  const allVisibleInitiatives = React.useMemo(() => {
    if (currentUser?.role === 'admin' || !currentUser?.visibleCategoryIds) return allInitiatives;
    return allInitiatives.filter(i => currentUser.visibleCategoryIds!.includes(i.categoryId));
  }, [allInitiatives, currentUser]);

  // Active initiatives (not deleted)
  const initiatives = React.useMemo(() =>
    allVisibleInitiatives.filter(i => !i.isDeleted),
    [allVisibleInitiatives]
  );

  // Soft-deleted initiatives
  const deletedInitiatives = React.useMemo(() =>
    allVisibleInitiatives.filter(i => i.isDeleted),
    [allVisibleInitiatives]
  );

  // Active tasks (not deleted)
  const tasks = React.useMemo(() => allTasks.filter(t => !t.isDeleted), [allTasks]);

  // Soft-deleted tasks
  const deletedTasks = React.useMemo(() => allTasks.filter(t => t.isDeleted), [allTasks]);

  const currentUserNotificationSettings = React.useMemo(() => {
    const userData = users.find(u => u.id === currentUser?.id);
    return userData?.notificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS;
  }, [users, currentUser]);

  // 自分が見えるスケジュール（作成者または参加者）
  const personalSchedules = React.useMemo(() =>
    allPersonalSchedules.filter(s =>
      !s.isArchived &&
      (s.createdBy === currentUser?.id || s.participantIds.includes(currentUser?.id || ''))
    ), [allPersonalSchedules, currentUser]);

  const archivedSchedules = React.useMemo(() =>
    allPersonalSchedules.filter(s =>
      s.isArchived &&
      (s.createdBy === currentUser?.id || s.participantIds.includes(currentUser?.id || ''))
    ), [allPersonalSchedules, currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            let role = userData.role;
            if (firebaseUser.email === 'miura.hearing@gmail.com' && role !== 'admin') {
              role = 'admin';
              updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' }).catch(console.error);
            }
            setCurrentUser({ id: userDoc.id, ...userData, role } as User);
          } else {
            const role = firebaseUser.email === 'miura.hearing@gmail.com' ? 'admin' : 'member';
            setCurrentUser({ id: firebaseUser.uid, name: firebaseUser.displayName || 'User', role } as User);
          }
        } else {
          setCurrentUser(null);
        }
      } catch (error: any) {
        console.error('[Auth] Firestore getDoc failed:', error?.code, error?.message, error);
        // Firestore取得失敗時もAuth情報でフォールバック（ログインループ防止）
        if (firebaseUser) {
          const role = firebaseUser.email === 'miura.hearing@gmail.com' ? 'admin' : 'member';
          setCurrentUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email || 'User',
            role,
          } as User);
        } else {
          setCurrentUser(null);
        }
      } finally {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isAuthReady || !currentUser) return;

    const handleSnapshotError = (name: string) => (error: Error) => {
      console.error(`[Firestore] ${name} listener error:`, error);
    };

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          role: data.email === 'miura.hearing@gmail.com' ? 'admin' : data.role
        } as User;
      }));
    }, handleSnapshotError('users'));
    const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setAllCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, handleSnapshotError('categories'));
    const unsubInitiatives = onSnapshot(collection(db, 'initiatives'), (snapshot) => {
      setAllInitiatives(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Initiative)));
    }, handleSnapshotError('initiatives'));
    const unsubTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const newTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setAllTasks(newTasks);
    }, handleSnapshotError('tasks'));
    const unsubMemos = onSnapshot(collection(db, 'memos'), (snapshot) => {
      setMemos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskMemo)));
    }, handleSnapshotError('memos'));
    const unsubPolls = onSnapshot(collection(db, 'meetingPolls'), (snapshot) => {
      setMeetingPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MeetingPoll)));
    }, handleSnapshotError('meetingPolls'));
    const unsubPersonalSchedules = onSnapshot(collection(db, 'personalSchedules'), (snapshot) => {
      setAllPersonalSchedules(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PersonalSchedule)));
    }, handleSnapshotError('personalSchedules'));
    const unsubAppSettings = onSnapshot(doc(db, 'appSettings', 'main'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppSettings({
          memberAnalysisAllowedUserIds: data.memberAnalysisAllowedUserIds ?? [],
        });
      }
    }, handleSnapshotError('appSettings'));

    return () => {
      unsubUsers();
      unsubCategories();
      unsubInitiatives();
      unsubTasks();
      unsubMemos();
      unsubPolls();
      unsubPersonalSchedules();
      unsubAppSettings();
    };
  }, [isAuthReady, currentUser]);

  // ---- 繰り返しタスクの自動リセット（セッション開始時に1回のみ実行）----
  useEffect(() => {
    // タスクが読み込まれていない、またはすでに実行済みの場合はスキップ
    if (!currentUser || allTasks.length === 0 || recurringResetDoneRef.current) return;

    const today = startOfDay(new Date());
    const tasksNeedingReset: Array<{ task: Task; period: { startDate: string; endDate: string } }> = [];

    for (const task of allTasks) {
      if (!task.recurringType || task.recurringType === 'none') continue;
      const period = getCurrentRecurringPeriod(task, today);
      if (!period) continue;
      if (task.startDate === period.startDate && task.endDate === period.endDate) continue;
      tasksNeedingReset.push({ task, period });
    }

    // 実行済みフラグをセット（書き込み前にセットして二重実行を防ぐ）
    recurringResetDoneRef.current = true;

    if (tasksNeedingReset.length > 0) {
      const batch = writeBatch(db);
      for (const { task, period } of tasksNeedingReset) {
        batch.update(doc(db, 'tasks', task.id), {
          startDate: period.startDate,
          endDate: period.endDate,
          isCompleted: false,
          completedBy: deleteField(),
          completedAt: deleteField(),
        });
      }
      batch.commit().catch(e => console.error('Error resetting recurring tasks:', e));
    }
  }, [allTasks, currentUser]);

  // ---- Notification scheduling ----

  useEffect(() => {
    if (!currentUser) return;
    const settings = currentUserNotificationSettings;
    if (!settings.weeklyEnabled && !settings.dailyEnabled) return;

    const checkAndFire = () => {
      const now = new Date();
      const todayKey = format(now, 'yyyy-MM-dd');

      // --- 週次通知 ---
      if (
        settings.weeklyEnabled &&
        now.getDay() === settings.weeklyDayOfWeek &&
        now.getHours() === settings.weeklyHour &&
        now.getMinutes() === settings.weeklyMinute
      ) {
        const storageKey = `tasuke_notif_weekly_${currentUser.id}`;
        if (localStorage.getItem(storageKey) !== todayKey) {
          const weekStart = startOfWeek(now, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
          const count = tasks.filter(t => {
            if (t.isCompleted || t.isDeleted) return false;
            if (!t.assigneeIds?.includes(currentUser.id)) return false;
            const end = parseISO(t.endDate);
            return end >= weekStart && end <= weekEnd;
          }).length;
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('今週のタスク', {
              body: `今週は${count}件のタスクがあります。`,
            });
          }
          localStorage.setItem(storageKey, todayKey);
        }
      }

      // --- 毎日通知 ---
      if (
        settings.dailyEnabled &&
        now.getHours() === settings.dailyHour &&
        now.getMinutes() === settings.dailyMinute
      ) {
        const storageKey = `tasuke_notif_daily_${currentUser.id}`;
        if (localStorage.getItem(storageKey) !== todayKey) {
          const todayStart = startOfDay(now);
          const deadline = addDays(todayStart, 3);
          const urgentTasks = tasks.filter(t => {
            if (t.isCompleted || t.isDeleted) return false;
            if (!t.assigneeIds?.includes(currentUser.id)) return false;
            const end = startOfDay(parseISO(t.endDate));
            return end >= todayStart && end <= deadline;
          });
          if ('Notification' in window && Notification.permission === 'granted' && urgentTasks.length > 0) {
            const lines = urgentTasks.slice(0, 5).map(t => `・${t.title}`).join('\n');
            const extra = urgentTasks.length > 5 ? `\n他${urgentTasks.length - 5}件` : '';
            new Notification('期限が近いタスク', {
              body: lines + extra,
            });
          }
          localStorage.setItem(storageKey, todayKey);
        }
      }
    };

    checkAndFire();
    const id = setInterval(checkAndFire, 60_000);
    return () => clearInterval(id);
  }, [currentUser, currentUserNotificationSettings, tasks]);

  // ---- End notification scheduling ----

  const logout = async () => {
    await signOut(auth);
  };

  const updateUser = async (userId: string, name: string, role: Role, visibleCategoryIds?: string[]) => {
    const data: any = { name, role };
    if (visibleCategoryIds !== undefined) {
      data.visibleCategoryIds = visibleCategoryIds;
    }
    await updateDoc(doc(db, 'users', userId), data);
  };

  const updateAppSettings = async (settings: Partial<AppSettings>) => {
    await setDoc(doc(db, 'appSettings', 'main'), settings, { merge: true });
  };

  const updateNotificationSettings = async (settings: NotificationSettings) => {
    if (!currentUser) return;
    await updateDoc(doc(db, 'users', currentUser.id), { notificationSettings: settings });
  };

  const requestNotificationPermission = async (): Promise<NotificationPermission | null> => {
    if (!('Notification' in window)) return null;
    if (Notification.permission !== 'default') return Notification.permission;
    return await Notification.requestPermission();
  };

  const addCategory = async (name: string, isAdminOnly: boolean) => {
    const newRef = doc(collection(db, 'categories'));
    await setDoc(newRef, { name, isAdminOnly });
  };

  const updateCategory = async (id: string, name: string, isAdminOnly: boolean) => {
    await updateDoc(doc(db, 'categories', id), { name, isAdminOnly });
  };

  const deleteCategory = async (id: string) => {
    await deleteDoc(doc(db, 'categories', id));
  };

  const addInitiative = async (title: string, categoryId: string, assigneeIds: string[] = [], description: string = '') => {
    const newRef = doc(collection(db, 'initiatives'));
    await setDoc(newRef, {
      title,
      categoryId,
      assigneeIds,
      description,
      isArchived: false,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.id || null,
    });
  };

  const updateInitiative = async (id: string, title: string, categoryId: string, assigneeIds: string[] = [], description: string = '') => {
    await updateDoc(doc(db, 'initiatives', id), {
      title,
      categoryId,
      assigneeIds,
      description,
      updatedBy: currentUser?.id || null,
      updatedAt: new Date().toISOString(),
    });
  };

  const archiveInitiative = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), {
      isArchived: true,
      completedBy: currentUser?.id || null,
      completedAt: new Date().toISOString(),
    });
  };

  const unarchiveInitiative = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), {
      isArchived: false,
      completedBy: deleteField(),
      completedAt: deleteField(),
    });
  };

  // Soft-delete initiative (moves to trash)
  const deleteInitiative = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.id || null,
    });
  };

  // Restore initiative from trash
  const restoreInitiative = async (id: string) => {
    await updateDoc(doc(db, 'initiatives', id), {
      isDeleted: false,
      deletedAt: deleteField(),
      deletedBy: deleteField(),
    });
  };

  // Permanently delete initiative and all its tasks (admin only, enforced in UI)
  const permanentDeleteInitiative = async (id: string) => {
    const initTasks = allTasks.filter(t => t.initiativeId === id);
    const batch = writeBatch(db);
    initTasks.forEach(task => {
      batch.delete(doc(db, 'tasks', task.id));
    });
    batch.delete(doc(db, 'initiatives', id));
    await batch.commit();
  };

  const addTask = async (
    initiativeId: string,
    title: string,
    startDate: string,
    endDate: string,
    assigneeIds: string[] = [],
    recurringOptions?: RecurringOptions
  ) => {
    const newRef = doc(collection(db, 'tasks'));
    const taskData: any = {
      initiativeId,
      title,
      assigneeIds,
      startDate,
      endDate,
      isCompleted: false,
      createdBy: currentUser?.id || null,
    };
    if (recurringOptions && recurringOptions.recurringType !== 'none') {
      taskData.recurringType = recurringOptions.recurringType;
      taskData.recurringDuration = recurringOptions.recurringDuration ?? 0;
      if (recurringOptions.recurringEndDate) taskData.recurringEndDate = recurringOptions.recurringEndDate;
      if (recurringOptions.recurringDaysOfWeek) taskData.recurringDaysOfWeek = recurringOptions.recurringDaysOfWeek;
      if (recurringOptions.recurringDatesOfMonth) taskData.recurringDatesOfMonth = recurringOptions.recurringDatesOfMonth;
      if (recurringOptions.recurringWeekOfMonth !== undefined) taskData.recurringWeekOfMonth = recurringOptions.recurringWeekOfMonth;
      if (recurringOptions.recurringDayOfWeekMonthly !== undefined) taskData.recurringDayOfWeekMonthly = recurringOptions.recurringDayOfWeekMonthly;
    }
    await setDoc(newRef, taskData);
  };

  // Kept for backward compatibility (old multi-task recurring)
  const addTasks = async (tasksData: { initiativeId: string, title: string, startDate: string, endDate: string, assigneeIds: string[], recurringGroupId?: string }[]) => {
    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < tasksData.length; i += CHUNK_SIZE) {
        const chunk = tasksData.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const data of chunk) {
          const newRef = doc(collection(db, 'tasks'));
          const taskData: any = {
            ...data,
            isCompleted: false,
            createdBy: currentUser?.id || null,
          };
          Object.keys(taskData).forEach(key => {
            if (taskData[key] === undefined) delete taskData[key];
          });
          batch.set(newRef, taskData);
        }
        await batch.commit();
      }
    } catch (error) {
      console.error('Error in addTasks:', error);
      throw error;
    }
  };

  const updateTask = async (taskId: string, title: string, startDate: string, endDate: string, assigneeIds: string[] = []) => {
    await updateDoc(doc(db, 'tasks', taskId), {
      title,
      startDate,
      endDate,
      assigneeIds,
      updatedBy: currentUser?.id || null,
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleTaskCompletion = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      const isCompleted = !task.isCompleted;
      const batch = writeBatch(db);
      batch.update(doc(db, 'tasks', id), {
        isCompleted,
        completedBy: isCompleted ? (currentUser?.id || null) : deleteField(),
        completedAt: isCompleted ? new Date().toISOString() : deleteField(),
        updatedBy: currentUser?.id || null,
        updatedAt: new Date().toISOString(),
      });
      // タスク完了時：紐づくスケジュールをアーカイブ
      if (isCompleted) {
        const linkedSchedules = allPersonalSchedules.filter(s => s.taskId === id && !s.isArchived);
        linkedSchedules.forEach(s => {
          batch.update(doc(db, 'personalSchedules', s.id), {
            isArchived: true,
            archivedAt: new Date().toISOString(),
          });
        });
      }
      await batch.commit();
    }
  };

  const updateTaskDescription = async (taskId: string, description: string) => {
    await updateDoc(doc(db, 'tasks', taskId), {
      description,
      updatedBy: currentUser?.id || null,
      updatedAt: new Date().toISOString(),
    });
  };

  // Soft-delete task (moves to trash)
  const deleteTask = async (id: string) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'tasks', id), {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.id || null,
    });
    // タスク削除時：紐づくスケジュールをアーカイブ
    const linkedSchedules = allPersonalSchedules.filter(s => s.taskId === id && !s.isArchived);
    linkedSchedules.forEach(s => {
      batch.update(doc(db, 'personalSchedules', s.id), {
        isArchived: true,
        archivedAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  };

  // Restore task from trash
  const restoreTask = async (id: string) => {
    await updateDoc(doc(db, 'tasks', id), {
      isDeleted: false,
      deletedAt: deleteField(),
      deletedBy: deleteField(),
    });
  };

  // Permanently delete task and its memos (admin only, enforced in UI)
  const permanentDeleteTask = async (id: string) => {
    const taskMemos = memos.filter(m => m.taskId === id);
    const batch = writeBatch(db);
    taskMemos.forEach(memo => {
      batch.delete(doc(db, 'memos', memo.id));
    });
    // タスク完全削除時：紐づくスケジュールも完全削除
    const linkedSchedules = allPersonalSchedules.filter(s => s.taskId === id);
    linkedSchedules.forEach(s => {
      batch.delete(doc(db, 'personalSchedules', s.id));
    });
    batch.delete(doc(db, 'tasks', id));
    await batch.commit();
  };

  const deleteMemo = async (memoId: string) => {
    await deleteDoc(doc(db, 'memos', memoId));
  };

  const addMemo = async (taskId: string, content: string) => {
    if (!currentUser) return;
    const newRef = doc(collection(db, 'memos'));
    await setDoc(newRef, {
      taskId,
      userId: currentUser.id,
      content,
      createdAt: new Date().toISOString(),
    });
  };

  const markTaskAsRead = async (taskId: string) => {
    if (!currentUser) return;
    await updateDoc(doc(db, 'tasks', taskId), {
      [`readStatus.${currentUser.id}`]: new Date().toISOString()
    });
  };

  const addMeetingPoll = async (title: string, description: string, targetUserIds: string[], options: string[]) => {
    if (!currentUser) return;
    const newRef = doc(collection(db, 'meetingPolls'));
    await setDoc(newRef, {
      title,
      description,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      targetUserIds,
      options,
      votes: {}
    });
  };

  const voteMeetingPoll = async (pollId: string, option: string, status: VoteStatus) => {
    if (!currentUser) return;
    const poll = meetingPolls.find(p => p.id === pollId);
    if (!poll) return;
    const userVotes = poll.votes[currentUser.id] || {};
    await updateDoc(doc(db, 'meetingPolls', pollId), {
      [`votes.${currentUser.id}`]: { ...userVotes, [option]: status }
    });
  };

  const updateMeetingPoll = async (pollId: string, title: string, description: string, targetUserIds: string[], options: string[]) => {
    await updateDoc(doc(db, 'meetingPolls', pollId), { title, description, targetUserIds, options });
  };

  const moveToTrashMeetingPoll = async (pollId: string) => {
    await updateDoc(doc(db, 'meetingPolls', pollId), {
      isDeleted: true,
      deletedAt: new Date().toISOString()
    });
  };

  const restoreMeetingPoll = async (pollId: string) => {
    await updateDoc(doc(db, 'meetingPolls', pollId), {
      isDeleted: false,
      deletedAt: deleteField()
    });
  };

  const deleteMeetingPoll = async (pollId: string) => {
    await deleteDoc(doc(db, 'meetingPolls', pollId));
  };

  const confirmMeetingPoll = async (pollId: string, option: string) => {
    await updateDoc(doc(db, 'meetingPolls', pollId), {
      confirmedOption: option,
      confirmedAt: new Date().toISOString(),
      confirmedBy: currentUser?.id || null,
    });
  };

  const cancelConfirmMeetingPoll = async (pollId: string) => {
    await updateDoc(doc(db, 'meetingPolls', pollId), {
      confirmedOption: deleteField(),
      confirmedAt: deleteField(),
      confirmedBy: deleteField(),
    });
  };

  const addPersonalSchedule = async (data: { title: string; memo?: string; color?: string; participantIds: string[]; startDateTime: string; endDateTime: string; taskId?: string }) => {
    if (!currentUser) return;
    const newRef = doc(collection(db, 'personalSchedules'));
    const scheduleData: any = {
      title: data.title,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      participantIds: data.participantIds,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
    };
    if (data.memo !== undefined) scheduleData.memo = data.memo;
    if (data.color) scheduleData.color = data.color;
    if (data.taskId) scheduleData.taskId = data.taskId;
    await setDoc(newRef, scheduleData);
  };

  const updatePersonalSchedule = async (id: string, data: { title?: string; memo?: string; color?: string; participantIds?: string[]; startDateTime?: string; endDateTime?: string }) => {
    const updateData: any = { ...data, updatedAt: new Date().toISOString() };
    Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);
    await updateDoc(doc(db, 'personalSchedules', id), updateData);
  };

  const updateMeetingPollMemo = async (pollId: string, memo: string) => {
    await updateDoc(doc(db, 'meetingPolls', pollId), { memo });
  };

  const archivePersonalSchedule = async (id: string) => {
    await updateDoc(doc(db, 'personalSchedules', id), {
      isArchived: true,
      archivedAt: new Date().toISOString(),
    });
  };

  const permanentDeletePersonalSchedule = async (id: string) => {
    await deleteDoc(doc(db, 'personalSchedules', id));
  };

  const bulkPermanentDeletePersonalSchedules = async (ids: string[]) => {
    if (ids.length === 0) return;
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'personalSchedules', id)));
    await batch.commit();
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <AppContext.Provider value={{
      currentUser, users, categories,
      initiatives, deletedInitiatives,
      tasks, deletedTasks,
      memos, meetingPolls,
      addCategory, updateCategory, deleteCategory,
      addInitiative, updateInitiative, archiveInitiative, unarchiveInitiative,
      deleteInitiative, restoreInitiative, permanentDeleteInitiative,
      addTask, addTasks, updateTask, toggleTaskCompletion, updateTaskDescription,
      deleteTask, restoreTask, permanentDeleteTask,
      addMemo, deleteMemo, markTaskAsRead,
      addMeetingPoll, voteMeetingPoll, updateMeetingPoll, moveToTrashMeetingPoll, restoreMeetingPoll, deleteMeetingPoll,
      confirmMeetingPoll, cancelConfirmMeetingPoll, updateMeetingPollMemo,
      personalSchedules, archivedSchedules,
      addPersonalSchedule, updatePersonalSchedule, archivePersonalSchedule, permanentDeletePersonalSchedule, bulkPermanentDeletePersonalSchedules,
      updateUser,
      appSettings,
      updateAppSettings,
      notificationSettings: currentUserNotificationSettings,
      updateNotificationSettings,
      requestNotificationPermission,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
