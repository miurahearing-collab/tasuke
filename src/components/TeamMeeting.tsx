import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import {
  Plus, Users, Calendar, Check, X, ChevronRight, ChevronLeft,
  ArrowLeft, CheckCircle2, Clock, Edit2, Trash2, CalendarDays, List,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { VoteStatus, PersonalSchedule } from '../types';
import {
  format, parseISO, addDays, addWeeks, addMonths, subMonths,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  isToday, startOfDay, isSameDay, isSameMonth,
  differenceInMinutes, setHours, setMinutes,
} from 'date-fns';

// ─── 定数 ──────────────────────────────────────────────────────────────
const HOUR_HEIGHT = 60; // 1時間あたりのピクセル
const START_HOUR = 7;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 15; // スナップ間隔

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

const snapTime = (date: Date): Date => {
  const mins = date.getMinutes();
  const snapped = Math.round(mins / SNAP_MINUTES) * SNAP_MINUTES;
  const result = new Date(date);
  result.setMinutes(snapped, 0, 0);
  return result;
};

const toLocalDateTimeString = (d: Date) =>
  `${format(d, 'yyyy-MM-dd')}T${format(d, 'HH:mm')}`;

const isoToDate = (iso: string) => new Date(iso);

// ─── 型定義 ───────────────────────────────────────────────────────────
interface DateTimeOption {
  date: string;
  startTime: string;
  endTime: string;
}

interface ScheduleModalState {
  mode: 'create' | 'edit';
  schedule?: PersonalSchedule;
  defaultDate?: string;
  defaultStartHour?: number;
}

interface DragState {
  scheduleId: string;
  type: 'move' | 'resize';
  startY: number;
  startX: number;
  originalStart: Date;
  originalEnd: Date;
  columnWidth: number;
  weekDays: Date[];
}

// ─── スケジュールモーダル ─────────────────────────────────────────────
const ScheduleModal = ({
  state,
  onClose,
  onSave,
  onDelete,
  tasks,
  users,
  currentUserId,
}: {
  state: ScheduleModalState;
  onClose: () => void;
  onSave: (data: {
    title: string; memo: string; participantIds: string[];
    startDateTime: string; endDateTime: string; taskId?: string;
  }) => void;
  onDelete?: () => void;
  tasks: any[];
  users: any[];
  currentUserId: string;
}) => {
  const isEdit = state.mode === 'edit';
  const s = state.schedule;

  const defaultDate = s
    ? format(isoToDate(s.startDateTime), 'yyyy-MM-dd')
    : (state.defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const defaultStart = s
    ? format(isoToDate(s.startDateTime), 'HH:mm')
    : `${String(state.defaultStartHour ?? 10).padStart(2, '0')}:00`;
  const defaultEnd = s
    ? format(isoToDate(s.endDateTime), 'HH:mm')
    : `${String((state.defaultStartHour ?? 10) + 1).padStart(2, '0')}:00`;

  const [title, setTitle] = useState(s?.title || '');
  const [memo, setMemo] = useState(s?.memo || '');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    s?.participantIds || [currentUserId]
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(s?.taskId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const taskAssigneeIds = selectedTask?.assigneeIds || (selectedTask?.assigneeId ? [selectedTask.assigneeId] : []);

  // タスク連携時は参加者をタスクの担当者のみに制限
  const availableParticipants = selectedTaskId
    ? users.filter(u => taskAssigneeIds.includes(u.id))
    : users;

  const toggleParticipant = (uid: string) => {
    if (uid === currentUserId) return; // 作成者は必ず含む
    setSelectedParticipants(prev =>
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleTaskSelect = (taskId: string) => {
    if (!taskId) {
      setSelectedTaskId(undefined);
      return;
    }
    setSelectedTaskId(taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const assignees = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : []);
      // 参加者をタスク担当者のみに絞る（現在ユーザーは必須）
      setSelectedParticipants(assignees.includes(currentUserId) ? assignees : [currentUserId, ...assignees.filter((id: string) => id !== currentUserId)]);
      setTitle(task.title);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const startDT = new Date(`${date}T${startTime}:00`);
    const endDT = new Date(`${date}T${endTime}:00`);
    if (endDT <= startDT) return;

    const participants = [...new Set([currentUserId, ...selectedParticipants])];
    onSave({
      title: title.trim(),
      memo,
      participantIds: participants,
      startDateTime: startDT.toISOString(),
      endDateTime: endDT.toISOString(),
      taskId: selectedTaskId,
    });
  };

  const isOwner = !s || s.createdBy === currentUserId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'スケジュールを編集' : 'スケジュールを作成'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* タイトル */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="スケジュールのタイトル"
              required
            />
          </div>

          {/* 日付・時間 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">日付 *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">終了時間</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メモ / MTG URL</label>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="メモやオンラインMTGのURLを入力"
            />
          </div>

          {/* タスク連携（新規作成時のみ or 未設定の場合） */}
          {(!isEdit || !s?.taskId) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タスクと連携（任意）</label>
              <select
                value={selectedTaskId || ''}
                onChange={e => handleTaskSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">連携なし</option>
                {tasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              {selectedTaskId && (
                <p className="text-xs text-amber-600 mt-1">
                  タスク連携時は参加者をタスクの担当者のみから選択できます。
                </p>
              )}
            </div>
          )}
          {isEdit && s?.taskId && (
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              タスクと連携済み
            </div>
          )}

          {/* 参加者 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">参加者</label>
            <div className="flex flex-wrap gap-2">
              {availableParticipants.map(u => {
                const isSelf = u.id === currentUserId;
                const selected = selectedParticipants.includes(u.id) || isSelf;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleParticipant(u.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                      selected
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300',
                      isSelf && 'opacity-75'
                    )}
                  >
                    {u.name}{isSelf ? '（自分）' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          {/* アクションボタン */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {isEdit && isOwner && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                削除（アーカイブ）
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {isEdit ? '保存' : '作成'}
              </button>
            </div>
          </div>
        </form>

        {/* 削除確認 */}
        {showDeleteConfirm && (
          <div className="px-6 pb-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-3">このスケジュールをアーカイブしますか？</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { onDelete?.(); onClose(); }}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  アーカイブ
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-white text-gray-700 text-sm border rounded hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── メインコンポーネント ─────────────────────────────────────────────
export const TeamMeeting = () => {
  const {
    currentUser, users, tasks, meetingPolls, personalSchedules,
    addMeetingPoll, voteMeetingPoll, moveToTrashMeetingPoll,
    confirmMeetingPoll, cancelConfirmMeetingPoll,
    addPersonalSchedule, updatePersonalSchedule, archivePersonalSchedule,
  } = useAppContext();

  // ─── タブ・ビュー状態 ───────────────────────────────────────────
  const [mainTab, setMainTab] = useState<'schedule' | 'polls'>('schedule');
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [calendarWeekStart, setCalendarWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  // ─── スケジュールモーダル ──────────────────────────────────────
  const [scheduleModal, setScheduleModal] = useState<ScheduleModalState | null>(null);

  // ─── ドラッグ状態 ─────────────────────────────────────────────
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [dragTemp, setDragTemp] = useState<{ start: Date; end: Date } | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<DragState | null>(null);
  const dragTempRef = useRef<{ start: Date; end: Date } | null>(null);

  // ─── 日程調整フォーム状態 ─────────────────────────────────────
  const [pollView, setPollView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dateTimeOptions, setDateTimeOptions] = useState<DateTimeOption[]>([
    { date: '', startTime: '10:00', endTime: '11:00' },
  ]);

  if (!currentUser) return null;

  // ─── 計算値 ───────────────────────────────────────────────────
  const myPolls = meetingPolls.filter(
    p => !p.isDeleted && (p.targetUserIds.includes(currentUser.id) || p.createdBy === currentUser.id)
  );

  const confirmedMeetings = useMemo(
    () =>
      myPolls
        .filter(p => p.confirmedOption)
        .map(p => ({ poll: p, parsed: parseOption(p.confirmedOption!) }))
        .filter((m): m is { poll: typeof m.poll; parsed: NonNullable<typeof m.parsed> } => m.parsed !== null),
    [myPolls]
  );

  // 自分が担当のタスク（未完了）
  const myTasks = useMemo(() =>
    tasks.filter(t =>
      !t.isCompleted && !t.isDeleted &&
      (t.assigneeIds?.includes(currentUser.id) || t.assigneeId === currentUser.id)
    ), [tasks, currentUser.id]);

  // 自分が見えるスケジュール
  const mySchedules = useMemo(() =>
    personalSchedules.filter(s =>
      s.createdBy === currentUser.id || s.participantIds.includes(currentUser.id)
    ), [personalSchedules, currentUser.id]);

  // ─── 週ビューの日付 ────────────────────────────────────────────
  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(calendarWeekStart, i)),
    [calendarWeekStart]
  );
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => START_HOUR + i);

  // ─── ドラッグ処理 ──────────────────────────────────────────────
  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = draggingRef.current;
    if (!drag || !calendarRef.current) return;

    const deltaY = e.clientY - drag.startY;
    const deltaX = e.clientX - drag.startX;
    const minutesPerPx = 60 / HOUR_HEIGHT;
    const rawMinutes = deltaY * minutesPerPx;
    const snappedMinutes = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;

    if (drag.type === 'move') {
      const dayDelta = Math.round(deltaX / drag.columnWidth);
      const newStart = new Date(drag.originalStart.getTime() + snappedMinutes * 60000);
      const newEnd = new Date(drag.originalEnd.getTime() + snappedMinutes * 60000);
      // 日付移動（週ビューのみ）
      if (drag.weekDays.length > 0) {
        newStart.setDate(newStart.getDate() + dayDelta);
        newEnd.setDate(newEnd.getDate() + dayDelta);
      }
      // 時間範囲制限
      const startHour = newStart.getHours() + newStart.getMinutes() / 60;
      const endHour = newEnd.getHours() + newEnd.getMinutes() / 60;
      if (startHour >= START_HOUR && endHour <= END_HOUR) {
        dragTempRef.current = { start: newStart, end: newEnd };
        setDragTemp({ start: newStart, end: newEnd });
      }
    } else {
      // リサイズ：終了時間のみ変更
      const newEnd = new Date(drag.originalEnd.getTime() + snappedMinutes * 60000);
      const minEnd = new Date(drag.originalStart.getTime() + 30 * 60000);
      const endHour = newEnd.getHours() + newEnd.getMinutes() / 60;
      if (newEnd > minEnd && endHour <= END_HOUR) {
        dragTempRef.current = { start: drag.originalStart, end: newEnd };
        setDragTemp({ start: drag.originalStart, end: newEnd });
      }
    }
  }, []);

  const handlePointerUp = useCallback(async () => {
    const drag = draggingRef.current;
    const temp = dragTempRef.current;
    if (!drag || !temp) {
      setDragging(null);
      setDragTemp(null);
      draggingRef.current = null;
      dragTempRef.current = null;
      return;
    }
    // Firestoreに保存
    await updatePersonalSchedule(drag.scheduleId, {
      startDateTime: temp.start.toISOString(),
      endDateTime: temp.end.toISOString(),
    });
    setDragging(null);
    setDragTemp(null);
    draggingRef.current = null;
    dragTempRef.current = null;
  }, [updatePersonalSchedule]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  const startDrag = (
    e: React.PointerEvent,
    schedule: PersonalSchedule,
    type: 'move' | 'resize',
    weekDaysList: Date[]
  ) => {
    if (!calendarRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const containerRect = calendarRef.current.getBoundingClientRect();
    const columnWidth = (containerRect.width - 48) / 7; // 48px for time labels
    const dragState: DragState = {
      scheduleId: schedule.id,
      type,
      startY: e.clientY,
      startX: e.clientX,
      originalStart: isoToDate(schedule.startDateTime),
      originalEnd: isoToDate(schedule.endDateTime),
      columnWidth,
      weekDays: weekDaysList,
    };
    draggingRef.current = dragState;
    dragTempRef.current = null;
    setDragging(dragState);
    setDragTemp(null);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  // ─── スケジュール保存 ──────────────────────────────────────────
  const handleScheduleSave = async (data: {
    title: string; memo: string; participantIds: string[];
    startDateTime: string; endDateTime: string; taskId?: string;
  }) => {
    if (scheduleModal?.mode === 'create') {
      await addPersonalSchedule(data);
    } else if (scheduleModal?.schedule) {
      await updatePersonalSchedule(scheduleModal.schedule.id, data);
    }
    setScheduleModal(null);
  };

  // ─── カレンダー：イベントの位置計算 ──────────────────────────────
  const getEventStyle = (start: Date, end: Date) => {
    const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
    const duration = differenceInMinutes(end, start);
    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max((duration / 60) * HOUR_HEIGHT, 20);
    return { top, height };
  };

  // ─── 週ビュー ─────────────────────────────────────────────────
  const renderWeekView = () => {
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ナビゲーション */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setCalendarWeekStart(prev => addDays(prev, -7))}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800">
            {format(calendarWeekStart, 'yyyy年M月d日')} 〜 {format(addDays(calendarWeekStart, 6), 'M月d日')}
          </span>
          <button
            onClick={() => setCalendarWeekStart(prev => addDays(prev, 7))}
            className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="flex border-b border-gray-200">
          <div className="w-12 shrink-0" />
          {weekDays.map((day, i) => (
            <div
              key={i}
              className={cn(
                'flex-1 text-center py-2 text-xs font-medium border-l border-gray-100',
                isToday(day) ? 'bg-blue-50 text-blue-700' : 'text-gray-600',
                i === 5 && 'text-blue-500',
                i === 6 && 'text-red-500',
              )}
            >
              <div>{dayNames[i]}</div>
              <div className={cn(
                'text-base font-bold mt-0.5',
                isToday(day) && 'w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto'
              )}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        {/* タイムグリッド */}
        <div
          ref={calendarRef}
          className="relative overflow-y-auto"
          style={{ maxHeight: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}
        >
          <div className="relative" style={{ height: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
            {/* 時間ラベルと横線 */}
            {hours.map(hour => (
              <div
                key={hour}
                className="absolute w-full flex"
                style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
              >
                <div className="w-12 shrink-0 pr-2 text-right text-xs text-gray-400 -mt-2.5">
                  {`${String(hour).padStart(2, '0')}:00`}
                </div>
                {weekDays.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex-1 border-l border-t border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors',
                      i === 5 && 'bg-blue-50/20',
                      i === 6 && 'bg-red-50/20',
                    )}
                    onClick={() => setScheduleModal({
                      mode: 'create',
                      defaultDate: format(weekDays[i], 'yyyy-MM-dd'),
                      defaultStartHour: hour,
                    })}
                  />
                ))}
              </div>
            ))}

            {/* 現在時刻ライン */}
            {weekDays.some(d => isToday(d)) && (() => {
              const now = new Date();
              const nowH = now.getHours() + now.getMinutes() / 60;
              if (nowH < START_HOUR || nowH > END_HOUR) return null;
              const top = (nowH - START_HOUR) * HOUR_HEIGHT;
              const dayIdx = weekDays.findIndex(d => isToday(d));
              const leftPct = (dayIdx / 7) * 100;
              return (
                <div className="absolute flex items-center pointer-events-none z-20" style={{ top, left: `calc(48px + ${leftPct}%)`, right: 0 }}>
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-0.5 bg-red-400" />
                </div>
              );
            })()}

            {/* 確定したミーティング */}
            {confirmedMeetings.map(({ poll, parsed }) => {
              const dayIdx = weekDays.findIndex(d =>
                isSameDay(d, parsed.startDateTime)
              );
              if (dayIdx === -1) return null;
              const isDragging = dragging?.scheduleId === poll.id;
              const displayStart = isDragging && dragTemp ? dragTemp.start : parsed.startDateTime;
              const displayEnd = isDragging && dragTemp ? dragTemp.end : parsed.endDateTime;
              const { top, height } = getEventStyle(displayStart, displayEnd);
              const leftPct = (dayIdx / 7) * 100;
              return (
                <div
                  key={poll.id}
                  className="absolute rounded-md px-1.5 py-1 text-xs text-white bg-green-600 shadow-sm cursor-pointer hover:opacity-90 overflow-hidden z-10"
                  style={{
                    top, height,
                    left: `calc(48px + ${leftPct}% + 2px)`,
                    width: `calc(${100 / 7}% - 4px)`,
                  }}
                  onClick={() => {/* 確定済みなので詳細表示のみ */}}
                  title={`${poll.title}（確定）`}
                >
                  <div className="font-medium truncate">{poll.title}</div>
                  <div className="text-green-200 text-[10px]">{parsed.startTime}〜{parsed.endTime}</div>
                  <div className="text-green-200 text-[10px]">確定済み</div>
                </div>
              );
            })}

            {/* 個人スケジュール */}
            {mySchedules.map(schedule => {
              const start = isoToDate(schedule.startDateTime);
              const end = isoToDate(schedule.endDateTime);
              const dayIdx = weekDays.findIndex(d => isSameDay(d, start));
              if (dayIdx === -1) return null;

              const isDragging = dragging?.scheduleId === schedule.id;
              const displayStart = isDragging && dragTemp ? dragTemp.start : start;
              const displayEnd = isDragging && dragTemp ? dragTemp.end : end;
              const { top, height } = getEventStyle(displayStart, displayEnd);
              const leftPct = (dayIdx / 7) * 100;
              const isOwner = schedule.createdBy === currentUser.id;

              // タスク連携バッジ
              const linkedTask = schedule.taskId ? tasks.find(t => t.id === schedule.taskId) : null;

              return (
                <div
                  key={schedule.id}
                  className={cn(
                    'absolute rounded-md px-1.5 py-1 text-xs shadow-sm overflow-hidden z-10',
                    schedule.taskId ? 'bg-purple-500 text-white' : 'bg-blue-500 text-white',
                    isDragging ? 'opacity-70 cursor-grabbing' : isOwner ? 'cursor-grab' : 'cursor-pointer',
                  )}
                  style={{
                    top, height,
                    left: `calc(48px + ${leftPct}% + 2px)`,
                    width: `calc(${100 / 7}% - 4px)`,
                  }}
                  onPointerDown={isOwner ? (e) => startDrag(e, schedule, 'move', weekDays) : undefined}
                  onClick={isDragging ? undefined : () => setScheduleModal({ mode: 'edit', schedule })}
                >
                  <div className="font-medium truncate">{schedule.title}</div>
                  <div className="text-blue-100 text-[10px]">
                    {format(displayStart, 'HH:mm')}〜{format(displayEnd, 'HH:mm')}
                  </div>
                  {linkedTask && <div className="text-purple-200 text-[10px] truncate">📌{linkedTask.title}</div>}
                  {/* リサイズハンドル */}
                  {isOwner && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize bg-black/10 hover:bg-black/20"
                      onPointerDown={(e) => { e.stopPropagation(); startDrag(e, schedule, 'resize', weekDays); }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ─── 月ビュー ─────────────────────────────────────────────────
  const renderMonthView = () => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) {
      days.push(cur);
      cur = addDays(cur, 1);
    }

    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

    const getEventsForDay = (day: Date) => {
      const personalEvts = mySchedules
        .filter(s => isSameDay(isoToDate(s.startDateTime), day))
        .map(s => ({ type: 'personal' as const, id: s.id, title: s.title, schedule: s }));
      const confirmedEvts = confirmedMeetings
        .filter(m => isSameDay(m.parsed.startDateTime, day))
        .map(m => ({ type: 'confirmed' as const, id: m.poll.id, title: m.poll.title, poll: m.poll, parsed: m.parsed }));
      return [...personalEvts, ...confirmedEvts];
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* ナビゲーション */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <button onClick={() => setCalendarMonth(prev => subMonths(prev, 1))} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800">{format(calendarMonth, 'yyyy年M月')}</span>
          <button onClick={() => setCalendarMonth(prev => addMonths(prev, 1))} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {dayNames.map((d, i) => (
            <div key={i} className={cn(
              'py-2 text-center text-xs font-medium',
              i === 5 && 'text-blue-500',
              i === 6 && 'text-red-500',
              i > 0 && 'border-l border-gray-100',
            )}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const evts = getEventsForDay(day);
            const inMonth = isSameMonth(day, calendarMonth);
            const dayOfWeek = idx % 7;
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[80px] p-1 border-b border-r border-gray-100 cursor-pointer hover:bg-gray-50',
                  !inMonth && 'bg-gray-50/50',
                  isToday(day) && 'bg-blue-50/50',
                  dayOfWeek === 0 && 'border-l-0',
                )}
                onClick={() => setScheduleModal({
                  mode: 'create',
                  defaultDate: format(day, 'yyyy-MM-dd'),
                })}
              >
                <div className={cn(
                  'text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isToday(day) ? 'bg-blue-600 text-white' : !inMonth ? 'text-gray-400' : dayOfWeek === 5 ? 'text-blue-600' : dayOfWeek === 6 ? 'text-red-600' : 'text-gray-700',
                )}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {evts.slice(0, 3).map(evt => (
                    <div
                      key={evt.id}
                      className={cn(
                        'px-1 py-0.5 rounded text-[10px] truncate text-white cursor-pointer',
                        evt.type === 'confirmed' ? 'bg-green-500' : 'bg-blue-500',
                      )}
                      onClick={e => {
                        e.stopPropagation();
                        if (evt.type === 'personal') {
                          setScheduleModal({ mode: 'edit', schedule: evt.schedule });
                        }
                      }}
                    >
                      {evt.title}
                    </div>
                  ))}
                  {evts.length > 3 && (
                    <div className="text-[10px] text-gray-500 px-1">+{evts.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── 確定したスケジュール一覧 ──────────────────────────────────
  const renderConfirmedList = () => {
    const upcoming = confirmedMeetings
      .filter(m => startOfDay(m.parsed.startDateTime) >= startOfDay(new Date()))
      .sort((a, b) => a.parsed.startDateTime.getTime() - b.parsed.startDateTime.getTime());
    if (upcoming.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          確定した日程調整
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

  // ─── 日程調整ポール画面 ────────────────────────────────────────
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = dateTimeOptions
      .filter(o => o.date && o.startTime && o.endTime)
      .map(o => `${format(parseISO(o.date), 'yyyy/MM/dd')} ${o.startTime}-${o.endTime}`);
    if (title.trim() && validOptions.length > 0 && selectedUsers.length > 0) {
      addMeetingPoll(title, description, selectedUsers, validOptions);
      setPollView('list');
      setTitle(''); setDescription(''); setSelectedUsers([]);
      setDateTimeOptions([{ date: '', startTime: '10:00', endTime: '11:00' }]);
    }
  };

  const toggleUserSelection = (userId: string) =>
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );

  const updateOption = (index: number, field: keyof DateTimeOption, value: string) => {
    const newOpts = [...dateTimeOptions];
    newOpts[index] = { ...newOpts[index], [field]: value };
    setDateTimeOptions(newOpts);
  };

  const renderPolls = () => {
    if (pollView === 'create') {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setPollView('list')} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900">新しい日程調整を作成</h3>
          </div>
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: 〇〇打ち合わせ"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">説明（任意）</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">対象メンバー *</label>
              <div className="flex flex-wrap gap-2">
                {users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUserSelection(u.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
                      selectedUsers.includes(u.id)
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                    )}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">候補日時 *</label>
                <button
                  type="button"
                  onClick={() => setDateTimeOptions([...dateTimeOptions, { date: '', startTime: '10:00', endTime: '11:00' }])}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  + 候補を追加
                </button>
              </div>
              <div className="space-y-2">
                {dateTimeOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="date"
                      value={opt.date}
                      onChange={e => updateOption(idx, 'date', e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                    <input
                      type="time"
                      value={opt.startTime}
                      onChange={e => updateOption(idx, 'startTime', e.target.value)}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                    <span className="text-gray-500 text-sm">〜</span>
                    <input
                      type="time"
                      value={opt.endTime}
                      onChange={e => updateOption(idx, 'endTime', e.target.value)}
                      className="w-24 px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                    />
                    {dateTimeOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDateTimeOptions(dateTimeOptions.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              作成する
            </button>
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
            <button onClick={() => { setPollView('list'); setSelectedPollId(null); setShowDeleteConfirm(false); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{poll.title}</h3>
              {poll.description && <p className="text-sm text-gray-500 mt-0.5">{poll.description}</p>}
            </div>
          </div>

          {isConfirmed && (
            <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-green-800">確定した日程</div>
                <div className="text-sm text-green-700">{poll.confirmedOption}</div>
              </div>
              {canConfirm && (
                <button
                  onClick={() => cancelConfirmMeetingPoll(poll.id)}
                  className="text-xs text-green-600 hover:text-green-800 whitespace-nowrap"
                >
                  取り消す
                </button>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">候補日時</th>
                    {poll.targetUserIds.map(uid => (
                      <th key={uid} className="px-3 py-3 text-center font-medium text-gray-600 text-xs whitespace-nowrap">
                        {users.find(u => u.id === uid)?.name || '不明'}
                      </th>
                    ))}
                    {canConfirm && !isConfirmed && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {poll.options.map(opt => {
                    const isConfirmedOpt = poll.confirmedOption === opt;
                    return (
                      <tr key={opt} className={cn(isConfirmedOpt && 'bg-green-50')}>
                        <td className="px-4 py-3 font-medium whitespace-nowrap text-gray-800">
                          {isConfirmedOpt && <span className="mr-1 text-green-600">✓</span>}
                          {opt}
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
                                    <button
                                      key={v}
                                      onClick={() => voteMeetingPoll(poll.id, opt, v)}
                                      className={cn(
                                        'w-6 h-6 rounded-full text-xs font-bold border transition-colors',
                                        vote === v
                                          ? v === 'ok' ? 'bg-green-500 text-white border-green-500'
                                          : v === 'fair' ? 'bg-yellow-400 text-white border-yellow-400'
                                          : 'bg-red-400 text-white border-red-400'
                                          : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400'
                                      )}
                                    >
                                      {v === 'ok' ? '○' : v === 'fair' ? '△' : '×'}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <span className={cn(
                                  'text-sm font-medium',
                                  vote === 'ok' ? 'text-green-600' : vote === 'fair' ? 'text-yellow-500' : vote === 'ng' ? 'text-red-500' : 'text-gray-300'
                                )}>
                                  {vote === 'ok' ? '○' : vote === 'fair' ? '△' : vote === 'ng' ? '×' : '―'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        {canConfirm && !isConfirmed && (
                          <td className="px-3 py-3 text-right">
                            <button
                              onClick={() => confirmMeetingPoll(poll.id, opt)}
                              className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded whitespace-nowrap"
                            >
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
            <div>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  削除する
                </button>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-sm text-red-800 mb-3">この日程調整を削除しますか？</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { moveToTrashMeetingPoll(poll.id); setPollView('list'); setSelectedPollId(null); setShowDeleteConfirm(false); }}
                      className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      削除
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 bg-white text-gray-700 text-sm border rounded hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // ポールリスト
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">日程調整</h3>
          <button
            onClick={() => setPollView('create')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規作成
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
              <button
                key={poll.id}
                onClick={() => { setSelectedPollId(poll.id); setPollView('detail'); }}
                className="w-full text-left bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">{poll.title}</h4>
                      {poll.confirmedOption && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium whitespace-nowrap">確定済み</span>
                      )}
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

  // ─── スケジュール画面全体 ──────────────────────────────────────
  const renderScheduleTab = () => (
    <div className="space-y-4">
      {/* ビュー切り替え + 新規作成ボタン */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalendarView('week')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              calendarView === 'week'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 bg-white border border-gray-300 hover:border-blue-300'
            )}
          >
            <CalendarDays className="w-4 h-4" />
            週
          </button>
          <button
            onClick={() => setCalendarView('month')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg font-medium transition-colors',
              calendarView === 'month'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 bg-white border border-gray-300 hover:border-blue-300'
            )}
          >
            <List className="w-4 h-4" />
            月
          </button>
        </div>
        <button
          onClick={() => setScheduleModal({ mode: 'create' })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          スケジュール作成
        </button>
      </div>

      {/* カレンダー本体 */}
      {calendarView === 'week' ? renderWeekView() : renderMonthView()}

      {/* 確定済みリスト */}
      {renderConfirmedList()}
    </div>
  );

  // ─── メインレンダリング ────────────────────────────────────────
  return (
    <div className="space-y-6 pb-12">
      {/* ページタイトル */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">スケジューラー</h2>
        <p className="text-gray-500 text-sm">スケジュール管理と日程調整</p>
      </div>

      {/* メインタブ */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setMainTab('schedule')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            mainTab === 'schedule' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Calendar className="w-4 h-4" />
          スケジュール
        </button>
        <button
          onClick={() => setMainTab('polls')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            mainTab === 'polls' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Users className="w-4 h-4" />
          日程調整
        </button>
      </div>

      {/* コンテンツ */}
      {mainTab === 'schedule' ? renderScheduleTab() : renderPolls()}

      {/* スケジュールモーダル */}
      {scheduleModal && (
        <ScheduleModal
          state={scheduleModal}
          onClose={() => setScheduleModal(null)}
          onSave={handleScheduleSave}
          onDelete={scheduleModal.schedule ? () => archivePersonalSchedule(scheduleModal.schedule!.id) : undefined}
          tasks={myTasks}
          users={users}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
};
