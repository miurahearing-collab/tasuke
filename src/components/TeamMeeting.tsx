import React, { useState, useMemo, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useAppContext } from '../store/AppContext';
import {
  Plus, Users, Calendar, Check, X, ChevronRight, ChevronLeft,
  ArrowLeft, CheckCircle2, Trash2, CalendarDays, List, StickyNote,
} from 'lucide-react';
import { TaskDetailModal } from './TaskDetailModal';
import { cn } from '../lib/utils';
import { VoteStatus, PersonalSchedule } from '../types';
import {
  format, parseISO, addDays, addMonths, subMonths,
  startOfWeek, startOfMonth, endOfMonth, endOfWeek,
  isToday, startOfDay, isSameDay, isSameMonth,
  differenceInMinutes,
} from 'date-fns';

// ─── 定数 ──────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 60;  // 1時間あたりのピクセル
const START_HOUR = 8;    // カレンダー表示開始時刻
const END_HOUR = 22;     // カレンダー表示終了時刻
const SCROLL_TO_HOUR = 9; // 初期スクロール位置（9時）
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 15;       // ドラッグスナップ間隔
const CREATE_SNAP_MINUTES = 30; // スロットクリック時の30分刻み

// ─── ユーティリティ ──────────────────────────────────────────────────────
const parseOption = (option: string) => {
  const match = option.match(/^(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return null;
  const [, dateStr, startTime, endTime] = match;
  const dateIso = dateStr.replace(/\//g, '-');
  const startDateTime = new Date(`${dateIso}T${startTime}:00`);
  const endDateTime = new Date(`${dateIso}T${endTime}:00`);
  return { dateStr, dateIso, startTime, endTime, startDateTime, endDateTime };
};

const isoToDate = (iso: string) => new Date(iso);

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// LocalStorage ベースの日付メモ
const DAY_MEMO_KEY = (userId: string, dateStr: string) =>
  `tasuke_dayMemo_${userId}_${dateStr}`;
const getDayMemoLS = (userId: string, dateStr: string): string =>
  localStorage.getItem(DAY_MEMO_KEY(userId, dateStr)) || '';
const setDayMemoLS = (userId: string, dateStr: string, text: string) => {
  if (text.trim()) {
    localStorage.setItem(DAY_MEMO_KEY(userId, dateStr), text.trim());
  } else {
    localStorage.removeItem(DAY_MEMO_KEY(userId, dateStr));
  }
};

// コンポーネント外定数（毎レンダリング生成を防ぐ）
const HOURS_LIST = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── スケジュールカラー定義 ──────────────────────────────────────────
export const SCHEDULE_COLORS: { id: string; bg: string; text: string; border?: string; label: string }[] = [
  { id: 'blue',   bg: '#3b82f6', text: '#ffffff', label: '青（デフォルト）' },
  { id: 'red',    bg: '#ef4444', text: '#ffffff', label: '赤' },
  { id: 'yellow', bg: '#eab308', text: '#1f2937', label: '黄' },
  { id: 'pink',   bg: '#ec4899', text: '#ffffff', label: 'ピンク' },
  { id: 'white',  bg: '#ffffff', text: '#374151', border: '#d1d5db', label: '白' },
  { id: 'gray',   bg: '#6b7280', text: '#ffffff', label: 'グレー' },
  { id: 'orange', bg: '#f97316', text: '#ffffff', label: 'オレンジ' },
  { id: 'black',  bg: '#1f2937', text: '#ffffff', label: '黒' },
];

const getScheduleColor = (colorId?: string) =>
  SCHEDULE_COLORS.find(c => c.id === colorId) ?? SCHEDULE_COLORS[0];

// ─── カスタム時間セレクト（30分刻み保証） ────────────────────────────
const TimeSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '10', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1">
      <select
        value={h}
        onChange={e => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)}
        className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {ALL_HOURS.map(hh => <option key={hh} value={hh}>{pad(hh)}</option>)}
      </select>
      <span className="text-gray-500 font-medium">:</span>
      <select
        value={m}
        onChange={e => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)}
        className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value={0}>00</option>
        <option value={30}>30</option>
      </select>
    </div>
  );
};

// ─── 型定義 ───────────────────────────────────────────────────────────
interface DateTimeOption { date: string; startTime: string; endTime: string; }

interface ScheduleModalState {
  mode: 'create' | 'edit';
  schedule?: PersonalSchedule;
  defaultDate?: string;
  defaultStartHour?: number;
  defaultStartMin?: number; // 0 or 30
}

// ─── スケジュールモーダル ─────────────────────────────────────────────
const ScheduleModal = ({
  state, onClose, onSave, onDelete, onOpenTask, tasks, users, currentUserId,
}: {
  state: ScheduleModalState;
  onClose: () => void;
  onSave: (data: { title: string; memo: string; color?: string; participantIds: string[]; startDateTime: string; endDateTime: string; taskId?: string }) => void;
  onDelete?: () => void;
  onOpenTask?: (taskId: string) => void;
  tasks: any[];
  users: any[];
  currentUserId: string;
}) => {
  const isEdit = state.mode === 'edit';
  const s = state.schedule;

  const padH = (h: number) => String(h).padStart(2, '0');
  const padM = (m: number) => String(m).padStart(2, '0');

  const defDate = s ? format(isoToDate(s.startDateTime), 'yyyy-MM-dd') : (state.defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const defSH = s ? format(isoToDate(s.startDateTime), 'HH:mm') : `${padH(state.defaultStartHour ?? 10)}:${padM(state.defaultStartMin ?? 0)}`;
  const defEH = s ? format(isoToDate(s.endDateTime), 'HH:mm') : (() => {
    const sh = state.defaultStartHour ?? 10;
    const sm = state.defaultStartMin ?? 0;
    const totalMin = sh * 60 + sm + 60;
    return `${padH(Math.floor(totalMin / 60) % 24)}:${padM(totalMin % 60)}`;
  })();

  const [title, setTitle] = useState(s?.title || '');
  const [memo, setMemo] = useState(s?.memo || '');
  const [color, setColor] = useState(s?.color || 'blue');
  const [date, setDate] = useState(defDate);
  const [startTime, setStartTime] = useState(defSH);
  const [endTime, setEndTime] = useState(defEH);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(s?.participantIds || [currentUserId]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(s?.taskId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (min: number) => { const mm = Math.min(Math.max(min, 0), 23 * 60 + 30); return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`; };

  // 開始時間変更時：終了時間を元の時間差を維持して自動連動
  const handleStartTimeChange = (newStart: string) => {
    const duration = toMin(endTime) - toMin(startTime);
    setStartTime(newStart);
    setEndTime(fromMin(toMin(newStart) + (duration > 0 ? duration : 60)));
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const taskAssigneeIds = selectedTask?.assigneeIds || (selectedTask?.assigneeId ? [selectedTask.assigneeId] : []);
  const availableParticipants = selectedTaskId ? users.filter(u => taskAssigneeIds.includes(u.id)) : users;

  const toggleParticipant = (uid: string) => {
    if (uid === currentUserId) return;
    setSelectedParticipants(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  const handleTaskSelect = (taskId: string) => {
    if (!taskId) { setSelectedTaskId(undefined); return; }
    setSelectedTaskId(taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const assignees = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
      setSelectedParticipants(assignees.includes(currentUserId) ? assignees : [currentUserId, ...assignees.filter((id: string) => id !== currentUserId)]);
      if (!s?.title) setTitle(task.title);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const startDT = new Date(`${date}T${startTime}:00`);
    const endDT = new Date(`${date}T${endTime}:00`);
    if (endDT <= startDT) return;
    const participants = [...new Set([currentUserId, ...selectedParticipants])];
    // タスク連携スケジュールはカラー固定（紫）なのでcolorを送らない
    onSave({ title: title.trim(), memo, color: selectedTaskId ? undefined : color, participantIds: participants, startDateTime: startDT.toISOString(), endDateTime: endDT.toISOString(), taskId: selectedTaskId });
  };

  const isOwner = !s || s.createdBy === currentUserId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'スケジュールを編集' : 'スケジュールを作成'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="スケジュールのタイトル" required />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
                <TimeSelect value={startTime} onChange={handleStartTimeChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
                <TimeSelect value={endTime} onChange={setEndTime} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ / MTG URL</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={7}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="メモやオンラインMTGのURL、議事録などを入力" />
          </div>

          {/* カラーピッカー（タスク連携なしの場合のみ） */}
          {!selectedTaskId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">カラー</label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.id)}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                    style={{
                      backgroundColor: c.bg,
                      border: color === c.id ? '3px solid #2563eb' : `2px solid ${c.border ?? c.bg}`,
                      boxShadow: color === c.id ? '0 0 0 2px #fff, 0 0 0 4px #2563eb' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {(!isEdit || !s?.taskId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タスクと連携（任意）</label>
              <select value={selectedTaskId || ''} onChange={e => handleTaskSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">連携なし</option>
                {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              {selectedTaskId && <p className="text-xs text-amber-600 mt-1">タスク連携時は参加者をタスクの担当者のみから選択できます。</p>}
            </div>
          )}
          {isEdit && s?.taskId && (() => {
            const linkedTask = tasks.find((t: any) => t.id === s.taskId);
            return (
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <span className="text-blue-500 font-medium">タスクと連携済み：</span>
                {linkedTask && onOpenTask ? (
                  <button
                    type="button"
                    onClick={() => { onOpenTask(s.taskId!); onClose(); }}
                    className="ml-1 text-blue-700 underline hover:text-blue-900 font-medium"
                  >
                    {linkedTask.title}
                  </button>
                ) : (
                  <span className="text-blue-700 ml-1">{linkedTask?.title || '（タスクが見つかりません）'}</span>
                )}
              </div>
            );
          })()}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">参加者</label>
            <div className="flex flex-wrap gap-2">
              {availableParticipants.map(u => {
                const isSelf = u.id === currentUserId;
                const selected = selectedParticipants.includes(u.id) || isSelf;
                return (
                  <button key={u.id} type="button" onClick={() => toggleParticipant(u.id)}
                    className={cn('px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                      selected ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300',
                      isSelf && 'opacity-75')}>
                    {u.name}{isSelf ? '（自分）' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {isEdit && isOwner && onDelete && (
              <button type="button" onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" />削除（アーカイブ）
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">キャンセル</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">{isEdit ? '保存' : '作成'}</button>
            </div>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-3">このスケジュールをアーカイブしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => { onDelete?.(); onClose(); }} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">アーカイブ</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-white text-gray-700 text-sm border rounded hover:bg-gray-50">キャンセル</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 重複イベントのレイアウト計算（汎用） ──────────────────────────
// 個人スケジュールも確定済み日程調整も同じロジックで横並び配置
type LayoutItem<T> = { start: number; end: number; data: T };
function layoutEvents<T>(events: LayoutItem<T>[]): Array<{ data: T; col: number; totalCols: number }> {
  if (events.length === 0) return [];
  if (events.length === 1) return [{ data: events[0].data, col: 0, totalCols: 1 }];
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
  const colEnds: number[] = [];
  const assigned: Array<LayoutItem<T> & { col: number }> = [];
  for (const ev of sorted) {
    let col = colEnds.findIndex(e => e <= ev.start);
    if (col === -1) { col = colEnds.length; colEnds.push(ev.end); }
    else { colEnds[col] = ev.end; }
    assigned.push({ ...ev, col });
  }
  return assigned.map(a => {
    const concurrent = assigned.filter(o => o.start < a.end && o.end > a.start);
    const totalCols = Math.max(...concurrent.map(c => c.col)) + 1;
    return { data: a.data, col: a.col, totalCols };
  });
}

// ─── 日付メモモーダル ──────────────────────────────────────────────────
const DayMemoModal = React.memo(({ dateStr, userId, onSave, onClose }: {
  dateStr: string; userId: string; onSave: (text: string) => void; onClose: () => void;
}) => {
  const [text, setText] = useState(() => getDayMemoLS(userId, dateStr));
  // 曜日付きの日付表示
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const d = new Date(dateStr + 'T00:00:00');
  const displayDate = `${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            {displayDate} のメモ
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            placeholder="この日のメモ、予定の詳細、MTG URL、議事録など..."
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              キャンセル
            </button>
            <button type="button" onClick={() => onSave(text)}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── 確定済み日程調整メモモーダル ─────────────────────────────────────
const ConfirmedMemoModal = React.memo(({ poll, onSave, onClose }: {
  poll: { id: string; title: string; memo?: string };
  onSave: (memo: string) => Promise<void>;
  onClose: () => void;
}) => {
  const [text, setText] = useState(poll?.memo || '');
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-orange-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-orange-500" />
            {poll?.title}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <p className="text-xs text-orange-600 font-medium">確定済み日程調整のメモ</p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-y"
            placeholder="議事録・URL・備考などを入力"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              キャンセル
            </button>
            <button type="button" onClick={() => onSave(text)}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── メインコンポーネント ─────────────────────────────────────────────
export const TeamMeeting = () => {
  const {
    currentUser, users, tasks, meetingPolls, personalSchedules,
    addMeetingPoll, voteMeetingPoll, moveToTrashMeetingPoll,
    confirmMeetingPoll, cancelConfirmMeetingPoll, updateMeetingPollMemo,
    addPersonalSchedule, updatePersonalSchedule, archivePersonalSchedule,
  } = useAppContext();

  const [mainTab, setMainTab] = useState<'schedule' | 'polls'>('schedule');
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [calendarWeekStart, setCalendarWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [scheduleModal, setScheduleModal] = useState<ScheduleModalState | null>(null);

  // ドラッグ中はDOM直接操作（Reactステート更新なし→再レンダリングゼロ）
  const [dragScheduleId, setDragScheduleId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const dragElemRef = useRef<HTMLElement | null>(null);
  const dragCurrentTemp = useRef<{ start: Date; end: Date } | null>(null);
  // ドラッグ完了後の楽観的更新（Firestoreタイミングに依存しない表示）
  const [localScheduleOverride, setLocalScheduleOverride] = useState<{
    id: string; startDateTime: string; endDateTime: string;
  } | null>(null);
  // ドラッグ直後のクリック誤発火防止
  const recentlyDraggedRef = useRef(false);

  // カレンダースクロールref
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  // グリッドのref（ドラッグ時のサイズ取得用）
  const gridRef = useRef<HTMLDivElement>(null);

  // 日付メモ用状態
  const [memoModalDate, setMemoModalDate] = useState<string | null>(null); // モーダル表示する日付
  const [memoVersion, setMemoVersion] = useState(0); // メモ保存時に再レンダリング
  // 確定済み日程調整のメモモーダル
  const [confirmedMemoModal, setConfirmedMemoModal] = useState<{ pollId: string; title: string } | null>(null);

  // 日程調整フォーム
  const [pollView, setPollView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDescription, setPollDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dateTimeOptions, setDateTimeOptions] = useState<DateTimeOption[]>([{ date: '', startTime: '10:00', endTime: '11:00' }]);

  if (!currentUser) return null;

  // ─── 計算値（すべてuseMemoでキャッシュ） ────────────────────────
  const myPolls = useMemo(() =>
    meetingPolls.filter(p =>
      !p.isDeleted && (p.targetUserIds.includes(currentUser.id) || p.createdBy === currentUser.id)
    ), [meetingPolls, currentUser.id]
  );

  const confirmedMeetings = useMemo(
    () => myPolls.filter(p => p.confirmedOption)
      .map(p => ({ poll: p, parsed: parseOption(p.confirmedOption!) }))
      .filter((m): m is { poll: typeof m.poll; parsed: NonNullable<typeof m.parsed> } => m.parsed !== null),
    [myPolls]
  );

  const myTasks = useMemo(() =>
    tasks.filter(t => !t.isCompleted && !t.isDeleted &&
      (t.assigneeIds?.includes(currentUser.id) || t.assigneeId === currentUser.id)),
    [tasks, currentUser.id]
  );

  const mySchedules = useMemo(() => {
    const raw = personalSchedules.filter(s => s.createdBy === currentUser.id || s.participantIds.includes(currentUser.id));
    // 楽観的更新: ドラッグ直後のローカルオーバーライドを適用（Firestoreの onSnapshot 反映までのズレ防止）
    if (!localScheduleOverride) return raw;
    return raw.map(s => s.id === localScheduleOverride.id
      ? { ...s, startDateTime: localScheduleOverride.startDateTime, endDateTime: localScheduleOverride.endDateTime }
      : s
    );
  }, [personalSchedules, currentUser.id, localScheduleOverride]);

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(calendarWeekStart, i)),
    [calendarWeekStart]
  );

  // 週ビュー用：日付ごとのスケジュールをMapでキャッシュ
  const schedulesPerDay = useMemo(() => {
    const map = new Map<string, typeof mySchedules>();
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, mySchedules.filter(s => isSameDay(isoToDate(s.startDateTime), day)));
    });
    return map;
  }, [mySchedules, weekDays]);

  const confirmedPerDay = useMemo(() => {
    const map = new Map<string, typeof confirmedMeetings>();
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      map.set(key, confirmedMeetings.filter(m => isSameDay(m.parsed.startDateTime, day)));
    });
    return map;
  }, [confirmedMeetings, weekDays]);

  // 日付メモをまとめてキャッシュ（LocalStorage複数回読み取り防止）
  const dayMemoMap = useMemo(() => {
    const map: Record<string, string> = {};
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      map[key] = getDayMemoLS(currentUser.id, key);
    });
    return map;
    // memoVersionが変わったときも再計算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays, currentUser.id, memoVersion]);

  // ─── スクロールを9時に初期化 ──────────────────────────────────
  useEffect(() => {
    if (calendarView === 'week' && calendarScrollRef.current) {
      const scrollPos = (SCROLL_TO_HOUR - START_HOUR) * HOUR_HEIGHT;
      calendarScrollRef.current.scrollTop = scrollPos;
    }
  }, [calendarView, calendarWeekStart]);

  // ─── スケジュール保存 ──────────────────────────────────────────
  const handleScheduleSave = async (data: { title: string; memo: string; color?: string; participantIds: string[]; startDateTime: string; endDateTime: string; taskId?: string }) => {
    if (scheduleModal?.mode === 'create') {
      await addPersonalSchedule(data);
    } else if (scheduleModal?.schedule) {
      await updatePersonalSchedule(scheduleModal.schedule.id, data);
    }
    setScheduleModal(null);
  };

  // ─── イベント位置計算 ──────────────────────────────────────────
  const getEventStyle = (start: Date, end: Date) => {
    const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const duration = Math.max(differenceInMinutes(end, start), 30);
    return {
      top: clamp((startMinutes / 60) * HOUR_HEIGHT, 0, TOTAL_HOURS * HOUR_HEIGHT - 20),
      height: Math.min((duration / 60) * HOUR_HEIGHT, TOTAL_HOURS * HOUR_HEIGHT),
    };
  };

  // ─── ドラッグ開始（DOM直接操作方式：ドラッグ中React再レンダリングなし）──
  const startDrag = (
    e: React.PointerEvent,
    schedule: PersonalSchedule,
    type: 'move' | 'resize',
    dayIdx: number
  ) => {
    e.stopPropagation();

    const originalStart = isoToDate(schedule.startDateTime);
    const originalEnd = isoToDate(schedule.endDateTime);
    const durationMs = originalEnd.getTime() - originalStart.getTime();
    // カレンダー開始からの分数
    const origStartMin = (originalStart.getHours() - START_HOUR) * 60 + originalStart.getMinutes();
    const origEndMin = (originalEnd.getHours() - START_HOUR) * 60 + originalEnd.getMinutes();
    const origTop = (origStartMin / 60) * HOUR_HEIGHT;
    const origHeight = Math.max(origEndMin - origStartMin, 30) / 60 * HOUR_HEIGHT;

    const eventElem = (type === 'resize'
      ? (e.currentTarget as HTMLElement).parentElement
      : e.currentTarget as HTMLElement) as HTMLElement;

    const startY = e.clientY;
    const startX = e.clientX;
    const getColumnWidth = () => (gridRef.current?.getBoundingClientRect().width ?? 700) / 7;

    // 一定距離以上動いてから初めて「ドラッグ開始」とみなす（クリック誤認防止）
    const DRAG_THRESHOLD = 4;
    let dragStarted = false;
    let ghost: HTMLDivElement | null = null;

    const beginDrag = () => {
      if (dragStarted) return;
      dragStarted = true;
      dragElemRef.current = eventElem;
      dragCurrentTemp.current = { start: new Date(originalStart), end: new Date(originalEnd) };
      eventElem.style.opacity = '0.7';
      eventElem.style.zIndex = '30';
      eventElem.style.cursor = type === 'resize' ? 's-resize' : 'grabbing';
      if (type === 'move' && gridRef.current) {
        ghost = document.createElement('div');
        ghost.style.cssText = [
          'position:absolute',
          'border-radius:6px',
          `background:rgba(59,130,246,0.2)`,
          'border:2px dashed #3b82f6',
          'pointer-events:none',
          'z-index:25',
          'display:none',
          `height:${origHeight}px`,
        ].join(';');
        gridRef.current.appendChild(ghost);
      }
      setDragScheduleId(schedule.id);
    };

    const onMove = (ev: PointerEvent) => {
      const deltaY = ev.clientY - startY;
      const deltaX = ev.clientX - startX;

      // しきい値未満はまだクリック扱い
      if (!dragStarted) {
        if (Math.abs(deltaY) < DRAG_THRESHOLD && Math.abs(deltaX) < DRAG_THRESHOLD) return;
        beginDrag();
      }

      const colW = getColumnWidth();
      const rawMinutes = (deltaY / HOUR_HEIGHT) * 60;
      const snappedMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;

      if (type === 'move') {
        // クランプ：開始がSTART_HOUR以上、終了がEND_HOUR以下
        const minOffset = -origStartMin;
        const maxOffset = TOTAL_HOURS * 60 - origEndMin;
        const clampedOffset = clamp(snappedMinutes, minOffset, maxOffset);

        const newTop = origTop + (clampedOffset / 60) * HOUR_HEIGHT;
        eventElem.style.top = `${newTop}px`;

        // DOMと完全に同期したdragCurrentTempを維持
        const newStart = new Date(originalStart.getTime() + clampedOffset * 60000);
        const newEnd = new Date(newStart.getTime() + durationMs);
        const dayDelta = Math.round(deltaX / colW);
        if (dayDelta !== 0) {
          newStart.setDate(newStart.getDate() + dayDelta);
          newEnd.setDate(newEnd.getDate() + dayDelta);
        }
        dragCurrentTemp.current = { start: newStart, end: newEnd };

        // ゴースト表示（他の列に移動した場合）
        if (ghost) {
          const targetCol = dayIdx + dayDelta;
          if (dayDelta !== 0 && targetCol >= 0 && targetCol < 7) {
            ghost.style.display = 'block';
            ghost.style.left = `${targetCol * colW + 2}px`;
            ghost.style.width = `${colW - 4}px`;
            ghost.style.top = `${newTop}px`;
          } else {
            ghost.style.display = 'none';
          }
        }
      } else {
        // リサイズ：duration を clamp してDOM + temp を同期
        const origDuration = origEndMin - origStartMin;
        const newDuration = clamp(origDuration + snappedMinutes, 30, TOTAL_HOURS * 60 - origStartMin);
        const newHeight = (newDuration / 60) * HOUR_HEIGHT;
        eventElem.style.height = `${newHeight}px`;
        const newEnd = new Date(originalStart.getTime() + newDuration * 60000);
        dragCurrentTemp.current = { start: originalStart, end: newEnd };
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      // ドラッグが開始されていなかった（＝プレーンなクリック）場合は何もしない
      // → onClick ハンドラが正常に動作する
      if (!dragStarted) return;

      ghost?.remove();
      ghost = null;

      // 透過・カーソルのみ即リセット（top/height は React の再レンダリングで正しい値に上書きされる）
      eventElem.style.opacity = '';
      eventElem.style.zIndex = '';
      eventElem.style.cursor = '';
      dragElemRef.current = null;

      const temp = dragCurrentTemp.current;
      dragCurrentTemp.current = null;

      const moved = temp && (
        temp.start.getTime() !== originalStart.getTime() ||
        temp.end.getTime() !== originalEnd.getTime()
      );

      if (moved && temp) {
        const newStart = temp.start.toISOString();
        const newEnd = temp.end.toISOString();
        // flushSync で同期的に React 再レンダリング → style prop により
        // eventElem の inline style が新しい位置で上書きされる（フラッシュなし）
        flushSync(() => {
          setLocalScheduleOverride({ id: schedule.id, startDateTime: newStart, endDateTime: newEnd });
          setDragScheduleId(null);
        });
        // Firestore へ反映（.then で override 解除）
        updatePersonalSchedule(schedule.id, { startDateTime: newStart, endDateTime: newEnd })
          .then(() => {
            setLocalScheduleOverride(prev => prev?.id === schedule.id ? null : prev);
          });
      } else {
        // 移動なし: インラインスタイルをクリアして元の位置に戻す
        eventElem.style.top = '';
        eventElem.style.height = '';
        setDragScheduleId(null);
      }

      // ドラッグ直後のクリック誤発火を防ぐ
      recentlyDraggedRef.current = true;
      setTimeout(() => { recentlyDraggedRef.current = false; }, 300);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // ─── 日付メモ操作 ─────────────────────────────────────────────
  const openMemoModal = (dateStr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMemoModalDate(dateStr);
  };

  const saveMemo = (dateStr: string, text: string) => {
    setDayMemoLS(currentUser.id, dateStr, text);
    setMemoVersion(v => v + 1);
    setMemoModalDate(null);
  };

  // ─── 週ビュー ─────────────────────────────────────────────────
  const renderWeekView = () => {
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

    // Mapから直接取得（ドラッグ中の位置はDOM操作で管理するためここでは不要）
    const getSchedulesForDay = (day: Date) =>
      schedulesPerDay.get(format(day, 'yyyy-MM-dd')) || [];

    const getConfirmedForDay = (day: Date) =>
      confirmedPerDay.get(format(day, 'yyyy-MM-dd')) || [];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 260px)' }}>
        {/* ナビゲーション */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={() => setCalendarWeekStart(prev => addDays(prev, -7))} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCalendarWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-md transition-colors"
            >
              今日
            </button>
          </div>
          <span className="text-sm font-semibold text-gray-800">
            {format(calendarWeekStart, 'yyyy年M月d日')} 〜 {format(addDays(calendarWeekStart, 6), 'M月d日')}
          </span>
          <button onClick={() => setCalendarWeekStart(prev => addDays(prev, 7))} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 曜日ヘッダー（メモ欄付き） */}
        <div className="flex shrink-0 border-b border-gray-200">
          {/* 時間ラベル用スペース */}
          <div className="w-10 shrink-0" />
          {weekDays.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const memoText = dayMemoMap[dateStr] ?? '';
            const hasMemo = !!memoText;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 text-center py-1 border-l border-gray-100 min-w-0',
                  isToday(day) ? 'bg-blue-50' : '',
                  i === 5 ? 'bg-blue-50/30' : '',
                  i === 6 ? 'bg-red-50/30' : '',
                )}
              >
                <div className={cn('text-[11px] font-medium', i === 5 && 'text-blue-600', i === 6 && 'text-red-600', !isToday(day) && i < 5 && 'text-gray-500')}>
                  {dayNames[i]}
                </div>
                <div className={cn(
                  'text-base font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full leading-none',
                  isToday(day) ? 'bg-blue-600 text-white' : i === 5 ? 'text-blue-600' : i === 6 ? 'text-red-600' : 'text-gray-800'
                )}>
                  {format(day, 'd')}
                </div>
                {/* 日付メモ：クリックでモーダルを開く */}
                <div className="px-1 py-0.5 min-h-[22px]">
                  <div
                    className={cn(
                      'text-[10px] text-left cursor-pointer rounded px-0.5 py-0.5 leading-tight hover:bg-amber-50 transition-colors',
                      hasMemo ? 'text-amber-700' : 'text-gray-400 hover:text-gray-500'
                    )}
                    onClick={e => openMemoModal(dateStr, e)}
                    title={hasMemo ? 'メモを編集' : 'メモを追加'}
                  >
                    {hasMemo ? (
                      <span className="flex items-center gap-0.5">
                        <StickyNote className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">メモあり</span>
                      </span>
                    ) : (
                      <span className="opacity-40">📝</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* タイムグリッド（スクロール可能） */}
        <div ref={calendarScrollRef} className="overflow-y-auto flex-1">
          <div className="flex" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
            {/* 時間ラベル列 */}
            <div className="w-10 shrink-0 relative">
              {HOURS_LIST.map(hour => (
                <div
                  key={hour}
                  className="absolute right-1 text-[10px] text-gray-400 text-right leading-none"
                  style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT - 6}px` }}
                >
                  {`${String(hour).padStart(2, '0')}:00`}
                </div>
              ))}
            </div>

            {/* 7列分の日カラム */}
            <div ref={gridRef} className="flex-1 flex relative">
              {weekDays.map((day, colIdx) => {
                const schedulesForDay = getSchedulesForDay(day);
                const confirmedForDay = getConfirmedForDay(day);
                const isSat = colIdx === 5;
                const isSun = colIdx === 6;

                return (
                  <div
                    key={colIdx}
                    className={cn(
                      'flex-1 relative border-l border-gray-100 cursor-pointer',
                      isSat && 'bg-blue-50/20',
                      isSun && 'bg-red-50/20',
                    )}
                    onClick={e => {
                      // イベントブロック上のクリックは無視
                      if ((e.target as HTMLElement).closest('[data-event]')) return;
                      // ドラッグ直後の誤クリックを無視
                      if (recentlyDraggedRef.current) return;
                      // 列の論理的なY座標（スクロール込み）
                      const rect = e.currentTarget.getBoundingClientRect();
                      const colRelY = e.clientY - rect.top;
                      const rawMin = (colRelY / HOUR_HEIGHT) * 60;
                      const snapped = Math.round(rawMin / CREATE_SNAP_MINUTES) * CREATE_SNAP_MINUTES;
                      const totalMin = clamp(snapped, 0, TOTAL_HOURS * 60 - 30);
                      const hour = START_HOUR + Math.floor(totalMin / 60);
                      const min = totalMin % 60;
                      setScheduleModal({
                        mode: 'create',
                        defaultDate: format(day, 'yyyy-MM-dd'),
                        defaultStartHour: hour,
                        defaultStartMin: min,
                      });
                    }}
                  >
                    {/* 横線（時間ライン） */}
                    {HOURS_LIST.map(hour => (
                      <React.Fragment key={hour}>
                        <div
                          className="absolute left-0 right-0 border-t border-gray-100 pointer-events-none"
                          style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px` }}
                        />
                        <div
                          className="absolute left-0 right-0 border-t border-dashed border-gray-100 pointer-events-none"
                          style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }}
                        />
                      </React.Fragment>
                    ))}

                    {/* 現在時刻ライン */}
                    {isToday(day) && (() => {
                      const now = new Date();
                      const nowH = now.getHours() + now.getMinutes() / 60;
                      if (nowH < START_HOUR || nowH > END_HOUR) return null;
                      return (
                        <div className="absolute left-0 right-0 flex items-center pointer-events-none z-20"
                          style={{ top: `${(nowH - START_HOUR) * HOUR_HEIGHT}px` }}>
                          <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                          <div className="flex-1 h-0.5 bg-red-400" />
                        </div>
                      );
                    })()}

                    {/* 確定済み日程調整 + 個人スケジュールを統合してレイアウト（Google カレンダー風の横並び表示） */}
                    {(() => {
                      type EventData =
                        | { kind: 'confirmed'; poll: typeof confirmedForDay[number]['poll']; parsed: typeof confirmedForDay[number]['parsed'] }
                        | { kind: 'personal'; schedule: PersonalSchedule };
                      const combined: LayoutItem<EventData>[] = [
                        ...confirmedForDay.map(({ poll, parsed }) => ({
                          start: parsed.startDateTime.getTime(),
                          end: parsed.endDateTime.getTime(),
                          data: { kind: 'confirmed' as const, poll, parsed },
                        })),
                        ...schedulesForDay.map(s => ({
                          start: isoToDate(s.startDateTime).getTime(),
                          end: isoToDate(s.endDateTime).getTime(),
                          data: { kind: 'personal' as const, schedule: s },
                        })),
                      ];
                      return layoutEvents(combined).map(({ data, col, totalCols }) => {
                        const leftPct = (col / totalCols) * 100;
                        const rightPct = ((totalCols - col - 1) / totalCols) * 100;
                        const posStyle = { left: `calc(${leftPct}% + 1px)`, right: `calc(${rightPct}% + 1px)` };

                        if (data.kind === 'confirmed') {
                          const { poll, parsed } = data;
                          const { top, height } = getEventStyle(parsed.startDateTime, parsed.endDateTime);
                          return (
                            <div
                              key={`poll-${poll.id}`}
                              data-event
                              className="absolute rounded-md px-1.5 py-1 shadow-sm cursor-pointer hover:opacity-90 overflow-hidden z-10 select-none"
                              style={{ top, height, minHeight: 20, ...posStyle, backgroundColor: '#f97316', color: '#ffffff' }}
                              title={`${poll.title}（確定済み日程調整）${poll.memo ? ' 📝メモあり' : ''}`}
                              onClick={e => { e.stopPropagation(); setConfirmedMemoModal({ pollId: poll.id, title: poll.title }); }}
                            >
                              <div className="font-medium text-[11px] truncate pointer-events-none">{poll.title}</div>
                              {height > 30 && (
                                <div className="text-orange-100 text-[10px] pointer-events-none">{parsed.startTime}〜{parsed.endTime}</div>
                              )}
                              {poll.memo && height > 30 && (
                                <div className="text-orange-200 text-[10px] pointer-events-none flex items-center gap-0.5">
                                  <span>📝</span><span>メモあり</span>
                                </div>
                              )}
                            </div>
                          );
                        }

                        const schedule = data.schedule;
                        const isDragging = dragScheduleId === schedule.id;
                        const displayStart = isoToDate(schedule.startDateTime);
                        const displayEnd = isoToDate(schedule.endDateTime);
                        const { top, height } = getEventStyle(displayStart, displayEnd);
                        const isOwner = schedule.createdBy === currentUser.id;
                        const linkedTask = schedule.taskId ? tasks.find(t => t.id === schedule.taskId) : null;
                        // タスク連携→紫固定、通常→カスタムカラー（デフォルト青）
                        const schedColor = linkedTask
                          ? { bg: '#a855f7', text: '#ffffff' }
                          : getScheduleColor(schedule.color);

                        return (
                          <div
                            key={`sched-${schedule.id}`}
                            className={cn(
                              'absolute rounded-md px-1.5 py-1 shadow-sm overflow-hidden z-10 select-none',
                              isDragging ? 'ring-2 ring-blue-300' : isOwner ? 'cursor-grab hover:opacity-90' : 'cursor-pointer hover:opacity-90',
                              schedColor.bg === '#ffffff' ? 'border border-gray-200' : '',
                            )}
                            data-event
                            style={{ top, height, minHeight: 20, ...posStyle, backgroundColor: schedColor.bg, color: schedColor.text }}
                            onPointerDown={isOwner ? (e) => startDrag(e, schedule, 'move', colIdx) : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              // ドラッグ直後のクリックは無視（onUp の直後 300ms）
                              if (recentlyDraggedRef.current) return;
                              setScheduleModal({ mode: 'edit', schedule });
                            }}
                          >
                            <div className="font-medium text-[11px] truncate pointer-events-none">{schedule.title}</div>
                            {height > 30 && (
                              <div className="text-[10px] pointer-events-none opacity-80">
                                {format(displayStart, 'HH:mm')}〜{format(displayEnd, 'HH:mm')}
                              </div>
                            )}
                            {schedule.memo && height > 30 && (
                              <div className="text-[10px] pointer-events-none opacity-70 flex items-center gap-0.5">
                                <span>📝</span><span>メモあり</span>
                              </div>
                            )}
                            {linkedTask && height > 42 && (
                              <div className="text-[10px] truncate pointer-events-none opacity-80">📌{linkedTask.title}</div>
                            )}
                            {/* リサイズハンドル */}
                            {isOwner && height > 24 && (
                              <div
                                className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize bg-gradient-to-t from-black/30 to-transparent flex items-end justify-center"
                                onPointerDown={e => { e.stopPropagation(); startDrag(e, schedule, 'resize', colIdx); }}
                              >
                                <div className="w-6 h-1 bg-white/50 rounded-full mb-0.5" />
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── 月ビュー ─────────────────────────────────────────────────
  const renderMonthView = () => {
    const monthStart = startOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

    const days: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) { days.push(cur); cur = addDays(cur, 1); }

    const getEventsForDay = (day: Date) => {
      const personal = mySchedules.filter(s => isSameDay(isoToDate(s.startDateTime), day));
      const confirmed = confirmedMeetings.filter(m => isSameDay(m.parsed.startDateTime, day));
      return { personal, confirmed };
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
          <button onClick={() => setCalendarMonth(prev => subMonths(prev, 1))} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800">{format(calendarMonth, 'yyyy年M月')}</span>
          <button onClick={() => setCalendarMonth(prev => addMonths(prev, 1))} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-200">
          {dayNames.map((d, i) => (
            <div key={i} className={cn('py-1 text-center text-xs font-medium', i > 0 && 'border-l border-gray-100', i === 5 && 'text-blue-500', i === 6 && 'text-red-500')}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const { personal, confirmed } = getEventsForDay(day);
            const inMonth = isSameMonth(day, calendarMonth);
            const dow = idx % 7; // 0=Mon..6=Sun
            const dateStr = format(day, 'yyyy-MM-dd');
            const hasMemo = !!localStorage.getItem(DAY_MEMO_KEY(currentUser.id, dateStr));
            return (
              <div
                key={day.toISOString()}
                className={cn('min-h-[90px] p-1 border-b border-r border-gray-100', !inMonth && 'bg-gray-50/60', isToday(day) && 'bg-blue-50/60', 'cursor-pointer hover:bg-gray-50')}
                onClick={() => setScheduleModal({ mode: 'create', defaultDate: format(day, 'yyyy-MM-dd') })}
              >
                <div className="flex items-center gap-0.5 mb-0.5">
                  <div className={cn('text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full',
                    isToday(day) ? 'bg-blue-600 text-white' : !inMonth ? 'text-gray-400' : dow === 5 ? 'text-blue-600' : dow === 6 ? 'text-red-600' : 'text-gray-700')}>
                    {format(day, 'd')}
                  </div>
                  {hasMemo && <StickyNote className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                </div>
                <div className="space-y-0.5">
                  {confirmed.slice(0, 1).map(m => (
                    <div key={m.poll.id} className="px-1 py-0.5 rounded text-[10px] text-white bg-green-500 truncate"
                      onClick={e => e.stopPropagation()}>
                      {m.poll.title}
                    </div>
                  ))}
                  {personal.slice(0, confirmed.length > 0 ? 1 : 2).map(s => (
                    <div key={s.id}
                      className={cn('px-1 py-0.5 rounded text-[10px] text-white truncate cursor-pointer', s.taskId ? 'bg-purple-500' : 'bg-blue-500')}
                      onClick={e => { e.stopPropagation(); setScheduleModal({ mode: 'edit', schedule: s }); }}>
                      {s.title}
                    </div>
                  ))}
                  {personal.length + confirmed.length > 2 && (
                    <div className="text-[10px] text-gray-400 px-0.5">+{personal.length + confirmed.length - 2}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── 確定済みリスト ────────────────────────────────────────────
  const renderConfirmedList = () => {
    const upcoming = confirmedMeetings
      .filter(m => startOfDay(m.parsed.startDateTime) >= startOfDay(new Date()))
      .sort((a, b) => a.parsed.startDateTime.getTime() - b.parsed.startDateTime.getTime());
    if (upcoming.length === 0) return null;
    return (
      <div className="space-y-2 mt-4">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />確定した日程調整
        </h4>
        {upcoming.map(({ poll, parsed }) => (
          <div key={poll.id} className="flex items-center gap-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">{poll.title}</div>
              <div className="text-xs text-gray-500">{parsed.dateStr} {parsed.startTime}〜{parsed.endTime}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ─── 日程調整（ポール）─────────────────────────────────────────
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = dateTimeOptions
      .filter(o => o.date && o.startTime && o.endTime)
      .map(o => `${format(parseISO(o.date), 'yyyy/MM/dd')} ${o.startTime}-${o.endTime}`);
    if (pollTitle.trim() && validOptions.length > 0 && selectedUsers.length > 0) {
      addMeetingPoll(pollTitle, pollDescription, selectedUsers, validOptions);
      setPollView('list'); setPollTitle(''); setPollDescription(''); setSelectedUsers([]);
      setDateTimeOptions([{ date: '', startTime: '10:00', endTime: '11:00' }]);
    }
  };

  const toggleUserSelection = (uid: string) =>
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  const updateOption = (i: number, field: keyof DateTimeOption, val: string) => {
    const opts = [...dateTimeOptions]; opts[i] = { ...opts[i], [field]: val };
    setDateTimeOptions(opts);
  };

  const renderPolls = () => {
    if (pollView === 'create') {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setPollView('list')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-gray-900">新しい日程調整を作成</h3>
          </div>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
              <input type="text" value={pollTitle} onChange={e => setPollTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="例: 〇〇打ち合わせ" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明（任意）</label>
              <textarea value={pollDescription} onChange={e => setPollDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">対象メンバー *</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <button key={u.id} type="button" onClick={() => toggleUserSelection(u.id)}
                    className={cn('px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      selectedUsers.includes(u.id) ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300')}>
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">候補日時 *</label>
                <button type="button" onClick={() => setDateTimeOptions([...dateTimeOptions, { date: '', startTime: '10:00', endTime: '11:00' }])}
                  className="text-xs text-blue-600 font-medium">+ 候補を追加</button>
              </div>
              <div className="space-y-2">
                {dateTimeOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="date" value={opt.date} onChange={e => updateOption(i, 'date', e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                    <input type="time" value={opt.startTime} onChange={e => updateOption(i, 'startTime', e.target.value)} step="1800" className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                    <span className="text-gray-500 text-sm">〜</span>
                    <input type="time" value={opt.endTime} onChange={e => updateOption(i, 'endTime', e.target.value)} step="1800" className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm" />
                    {dateTimeOptions.length > 1 && (
                      <button type="button" onClick={() => setDateTimeOptions(dateTimeOptions.filter((_, j) => j !== i))} className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">作成する</button>
          </form>
        </div>
      );
    }

    if (pollView === 'detail' && selectedPollId) {
      const poll = myPolls.find(p => p.id === selectedPollId);
      if (!poll) return null;
      const isCreator = poll.createdBy === currentUser.id;
      const canConfirm = isCreator || currentUser.role === 'admin';
      const isConfirmed = !!poll.confirmedOption;

      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setPollView('list'); setSelectedPollId(null); setShowDeleteConfirm(false); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{poll.title}</h3>
              {poll.description && <p className="text-sm text-gray-500">{poll.description}</p>}
            </div>
          </div>
          {isConfirmed && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-green-800">確定した日程</div>
                <div className="text-sm text-green-700">{poll.confirmedOption}</div>
              </div>
              {canConfirm && <button onClick={() => cancelConfirmMeetingPoll(poll.id)} className="text-xs text-green-600 hover:text-green-800 whitespace-nowrap">取り消す</button>}
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">候補日時</th>
                    {poll.targetUserIds.map(uid => (
                      <th key={uid} className="px-3 py-3 text-center font-medium text-gray-600 text-xs whitespace-nowrap">{users.find(u => u.id === uid)?.name || '不明'}</th>
                    ))}
                    {canConfirm && !isConfirmed && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {poll.options.map(opt => {
                    const isConfirmedOpt = poll.confirmedOption === opt;
                    return (
                      <tr key={opt} className={isConfirmedOpt ? 'bg-green-50' : ''}>
                        <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-800">
                          {isConfirmedOpt && <span className="mr-1 text-green-600">✓</span>}{opt}
                        </td>
                        {poll.targetUserIds.map(uid => {
                          const vote = poll.votes[uid]?.[opt] || 'none';
                          const isMe = uid === currentUser.id;
                          const voteOptions: VoteStatus[] = ['ok', 'fair', 'ng'];
                          return (
                            <td key={uid} className="px-3 py-3 text-center">
                              {isMe && !isConfirmed ? (
                                <div className="flex items-center justify-center gap-1">
                                  {voteOptions.map(v => (
                                    <button key={v} onClick={() => voteMeetingPoll(poll.id, opt, v)}
                                      className={cn('w-6 h-6 rounded-full text-xs font-bold border transition-colors',
                                        vote === v
                                          ? v === 'ok' ? 'bg-green-500 text-white border-green-500' : v === 'fair' ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-red-400 text-white border-red-400'
                                          : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400')}>
                                      {v === 'ok' ? '○' : v === 'fair' ? '△' : '×'}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className={cn('text-sm font-medium', vote === 'ok' ? 'text-green-600' : vote === 'fair' ? 'text-yellow-500' : vote === 'ng' ? 'text-red-500' : 'text-gray-300')}>
                                  {vote === 'ok' ? '○' : vote === 'fair' ? '△' : vote === 'ng' ? '×' : '―'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {canConfirm && !isConfirmed && (
                          <td className="px-3 py-3 text-right">
                            <button onClick={() => confirmMeetingPoll(poll.id, opt)}
                              className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded whitespace-nowrap">
                              この日程で確定
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {isCreator && (
            !showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700">
                <Trash2 className="w-4 h-4" />削除する
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-800 mb-3">この日程調整を削除しますか？</p>
                <div className="flex gap-2">
                  <button onClick={() => { moveToTrashMeetingPoll(poll.id); setPollView('list'); setSelectedPollId(null); setShowDeleteConfirm(false); }}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700">削除</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-white text-gray-700 text-sm border rounded hover:bg-gray-50">キャンセル</button>
                </div>
              </div>
            )
          )}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">日程調整</h3>
          <button onClick={() => setPollView('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />新規作成
          </button>
        </div>
        {myPolls.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>日程調整はありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPolls.map(poll => (
              <button key={poll.id} onClick={() => { setSelectedPollId(poll.id); setPollView('detail'); }}
                className="w-full text-left bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900 group-hover:text-blue-600 truncate">{poll.title}</h4>
                      {poll.confirmedOption && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium whitespace-nowrap">確定済み</span>}
                    </div>
                    {poll.description && <p className="text-sm text-gray-500 mt-1 truncate">{poll.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">候補: {poll.options.length}件 / メンバー: {poll.targetUserIds.length}名</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── スケジュールタブ ──────────────────────────────────────────
  const renderScheduleTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setCalendarView('week')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              calendarView === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600 bg-white border border-gray-300 hover:border-blue-300')}>
            <CalendarDays className="w-4 h-4" />週
          </button>
          <button onClick={() => setCalendarView('month')}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              calendarView === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 bg-white border border-gray-300 hover:border-blue-300')}>
            <List className="w-4 h-4" />月
          </button>
        </div>
        <button onClick={() => setScheduleModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" />スケジュール作成
        </button>
      </div>
      {calendarView === 'week' ? renderWeekView() : renderMonthView()}
      {renderConfirmedList()}
    </div>
  );

  // ─── メインレンダリング ────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">スケジューラー</h2>
        <p className="text-gray-500 text-sm">スケジュール管理と日程調整</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setMainTab('schedule')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            mainTab === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          <Calendar className="w-4 h-4" />スケジュール
        </button>
        <button onClick={() => setMainTab('polls')}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            mainTab === 'polls' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
          <Users className="w-4 h-4" />日程調整
        </button>
      </div>

      {mainTab === 'schedule' ? renderScheduleTab() : renderPolls()}

      {scheduleModal && (
        <ScheduleModal
          state={scheduleModal}
          onClose={() => setScheduleModal(null)}
          onSave={handleScheduleSave}
          onDelete={scheduleModal.schedule ? () => archivePersonalSchedule(scheduleModal.schedule!.id) : undefined}
          onOpenTask={(taskId) => { setScheduleModal(null); setOpenTaskId(taskId); }}
          tasks={myTasks}
          users={users}
          currentUserId={currentUser.id}
        />
      )}
      {openTaskId && (
        <TaskDetailModal taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
      )}
      {memoModalDate && (
        <DayMemoModal
          dateStr={memoModalDate}
          userId={currentUser.id}
          onSave={(text) => saveMemo(memoModalDate, text)}
          onClose={() => setMemoModalDate(null)}
        />
      )}

      {/* 確定済み日程調整のメモモーダル */}
      {confirmedMemoModal && (() => {
        const poll = meetingPolls.find(p => p.id === confirmedMemoModal.pollId);
        return (
          <ConfirmedMemoModal
            poll={poll!}
            onSave={async (memo) => {
              await updateMeetingPollMemo(confirmedMemoModal.pollId, memo);
              setConfirmedMemoModal(null);
            }}
            onClose={() => setConfirmedMemoModal(null)}
          />
        );
      })()}
    </div>
  );
};
