import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { X, Send, Save, MessageSquare, Trash2, AlertTriangle, CalendarPlus, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';

// ─── 30分刻み時間セレクト ───────────────────────────────────────────
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = (n: number) => String(n).padStart(2, '0');
const TimeSelect = ({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) => {
  const parts = value.split(':');
  const h = parseInt(parts[0] ?? '10', 10);
  const m = parseInt(parts[1] ?? '0', 10);
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <select
        value={h}
        onChange={e => onChange(`${pad(Number(e.target.value))}:${pad(m)}`)}
        className="flex-1 px-2 py-1.5 border border-blue-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {ALL_HOURS.map(hh => <option key={hh} value={hh}>{pad(hh)}</option>)}
      </select>
      <span className="text-blue-400 font-medium text-xs">:</span>
      <select
        value={m}
        onChange={e => onChange(`${pad(h)}:${pad(Number(e.target.value))}`)}
        className="w-14 px-2 py-1.5 border border-blue-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value={0}>00</option>
        <option value={30}>30</option>
      </select>
    </div>
  );
};

export const TaskDetailModal = ({ taskId, onClose }: { taskId: string, onClose: () => void }) => {
  const { tasks, memos, users, currentUser, updateTaskDescription, updateTask, addMemo, deleteMemo, markTaskAsRead, deleteTask, toggleTaskCompletion, personalSchedules, addPersonalSchedule } = useAppContext();
  const task = tasks.find(t => t.id === taskId);
  
  const [description, setDescription] = useState(task?.description || '');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newMemo, setNewMemo] = useState('');
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds || []);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [startDate, setStartDate] = useState(task?.startDate || '');
  const [endDate, setEndDate] = useState(task?.endDate || '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memoToDelete, setMemoToDelete] = useState<string | null>(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedDate, setSchedDate] = useState(task?.startDate || '');
  const [schedStart, setSchedStart] = useState('10:00');
  const [schedEnd, setSchedEnd] = useState('11:00');

  // 開始時間変更：終了時間を元の時間差を保ったまま自動連動
  const handleSchedStartChange = (newStart: string) => {
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fromMin = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
    const duration = toMin(schedEnd) - toMin(schedStart);
    const newStartMin = toMin(newStart);
    const newEndMin = newStartMin + (duration > 0 ? duration : 60);
    setSchedStart(newStart);
    setSchedEnd(fromMin(Math.min(newEndMin, 23 * 60 + 30))); // 23:30 を上限
  };

  useEffect(() => {
    if (task) {
      markTaskAsRead(task.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, markTaskAsRead]);

  if (!task) return null;

  // スケジュール登録済みチェック（自分が作成者または参加者として）
  const isScheduled = personalSchedules.some(s =>
    s.taskId === taskId && !s.isArchived &&
    (s.createdBy === currentUser?.id || s.participantIds.includes(currentUser?.id || ''))
  );

  const handleRegisterSchedule = async () => {
    if (!currentUser || !schedDate) return;
    const startDT = new Date(`${schedDate}T${schedStart}:00`);
    const endDT = new Date(`${schedDate}T${schedEnd}:00`);
    if (endDT <= startDT) return;
    const taskAssigneeIds = task.assigneeIds || (task.assigneeId ? [task.assigneeId] : [currentUser.id]);
    const participants = [...new Set([currentUser.id, ...taskAssigneeIds])];
    await addPersonalSchedule({
      title: task.title,
      participantIds: participants,
      startDateTime: startDT.toISOString(),
      endDateTime: endDT.toISOString(),
      taskId: taskId,
    });
    setShowScheduleForm(false);
  };

  const taskMemos = memos.filter(m => m.taskId === taskId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleDelete = () => {
    deleteTask(taskId);
    onClose();
  };

  const handleSaveDescription = () => {
    updateTaskDescription(taskId, description);
    setIsEditingDesc(false);
  };

  const handleSaveAssignee = () => {
    updateTask(taskId, task.title, task.startDate, task.endDate, assigneeIds);
    setIsEditingAssignee(false);
  };

  const handleSaveDates = () => {
    if (startDate && endDate && new Date(startDate) <= new Date(endDate)) {
      updateTask(taskId, task.title, startDate, endDate, task.assigneeIds);
      setIsEditingDates(false);
    } else {
      alert('有効な日付を入力してください（開始日は終了日以前である必要があります）');
    }
  };

  const handleAddMemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemo.trim()) {
      addMemo(taskId, newMemo.trim());
      setNewMemo('');
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || '不明なユーザー';
  const getAssigneeNames = (ids?: string[], fallbackId?: string) => {
    if (ids && ids.length > 0) {
      return ids.map(id => getUserName(id)).filter(Boolean).join(', ');
    }
    if (fallbackId) {
      return getUserName(fallbackId);
    }
    return '未設定';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start gap-3 justify-between bg-gray-50">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-gray-900 break-all">{task.title}</h2>
            <div className="text-sm text-gray-500 mt-1 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span>期間:</span>
                {isEditingDates ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border border-gray-300 rounded-md text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <span>~</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border border-gray-300 rounded-md text-xs py-1 px-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button onClick={handleSaveDates} className="text-blue-600 hover:text-blue-800"><Save className="w-4 h-4" /></button>
                    <button onClick={() => { setStartDate(task.startDate); setEndDate(task.endDate); setIsEditingDates(false); }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{format(parseISO(task.startDate), 'yyyy/MM/dd')} ~ {format(parseISO(task.endDate), 'yyyy/MM/dd')}</span>
                    <button onClick={() => setIsEditingDates(true)} className="text-blue-600 hover:text-blue-800 text-xs">変更</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span>担当:</span>
                {isEditingAssignee ? (
                  <div className="flex items-center gap-2 relative">
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md p-2 z-10 w-48 max-h-48 overflow-y-auto">
                      {users.map(u => (
                        <label key={u.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input 
                            type="checkbox" 
                            checked={assigneeIds.includes(u.id)}
                            onChange={() => toggleAssignee(u.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          {u.name}
                        </label>
                      ))}
                    </div>
                    <button onClick={handleSaveAssignee} className="text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded text-xs">保存</button>
                    <button onClick={() => { setAssigneeIds(task.assigneeIds || []); setIsEditingAssignee(false); }} className="text-gray-500 hover:text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">キャンセル</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{getAssigneeNames(task.assigneeIds, task.assigneeId)}</span>
                    <button onClick={() => setIsEditingAssignee(true)} className="text-blue-600 hover:text-blue-800 text-xs">変更</button>
                  </div>
                )}
              </div>
              {task.createdBy && (
                <div className="flex items-center gap-1 text-xs">
                  <span>作成者:</span>
                  <span className="font-medium text-gray-900">{getUserName(task.createdBy)}</span>
                </div>
              )}
              {task.isCompleted && task.completedBy && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <span>完了者:</span>
                  <span className="font-medium">{getUserName(task.completedBy)}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* スケジュール登録ボタン */}
            {isScheduled ? (
              <span className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-md whitespace-nowrap">
                <Check className="w-3.5 h-3.5" />
                スケジュール済み
              </span>
            ) : (
              <button
                onClick={() => setShowScheduleForm(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors whitespace-nowrap"
                title="スケジュールに登録"
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                スケジュール登録
              </button>
            )}
            <button
              onClick={() => toggleTaskCompletion(task.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                task.isCompleted
                  ? 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                  : 'text-green-700 bg-green-50 hover:bg-green-100'
              }`}
              title={task.isCompleted ? '未完了に戻す' : '完了にする'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {task.isCompleted ? '未完了に戻す' : '完了にする'}
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="タスクを削除">
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* スケジュール登録フォーム */}
        {showScheduleForm && !isScheduled && (
          <div className="mx-6 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-1.5">
              <CalendarPlus className="w-4 h-4" />
              スケジュールに登録
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs text-blue-700 mb-1">日付</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className="w-full px-2 py-1.5 border border-blue-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">開始</label>
                <TimeSelect value={schedStart} onChange={handleSchedStartChange} />
              </div>
              <div>
                <label className="block text-xs text-blue-700 mb-1">終了</label>
                <TimeSelect value={schedEnd} onChange={setSchedEnd} />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleRegisterSchedule}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700"
              >
                登録する
              </button>
              <button
                onClick={() => setShowScheduleForm(false)}
                className="px-3 py-1.5 bg-white text-gray-600 border border-gray-300 text-xs rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 mb-3">このタスクを削除してもよろしいですか？</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700">
                削除する
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50">
                キャンセル
              </button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          {/* Description Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">説明・概要</h3>
              {!isEditingDesc && (
                <button 
                  onClick={() => setIsEditingDesc(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  編集する
                </button>
              )}
            </div>
            
            {isEditingDesc ? (
              <div className="space-y-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px] resize-y"
                  placeholder="タスクの詳細やアップデートをここに記入..."
                />
                <div className="flex justify-end gap-2">
                  <button 
                    onClick={() => {
                      setDescription(task.description || '');
                      setIsEditingDesc(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md"
                  >
                    キャンセル
                  </button>
                  <button 
                    onClick={handleSaveDescription}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-1"
                  >
                    <Save className="w-3 h-3" />
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap min-h-[60px] border border-gray-100">
                {task.description || <span className="text-gray-400 italic">説明はまだありません。</span>}
              </div>
            )}
          </section>

          {/* Memos / Chat Section */}
          <section className="flex-1 flex flex-col min-h-[300px]">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              メモ・コメント
            </h3>
            
            <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-4 flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                {taskMemos.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm py-8">
                    まだメモやコメントはありません。
                  </div>
                ) : (
                  taskMemos.map(memo => {
                    const isMine = memo.userId === currentUser?.id;
                    const canDelete = currentUser?.role === 'admin' || isMine;
                    return (
                      <div key={memo.id} className={cn("flex flex-col max-w-[85%] group/memo", isMine ? "ml-auto items-end" : "mr-auto items-start")}>
                        <div className="text-xs text-gray-500 mb-1 px-1 flex items-center gap-2">
                          <span className="font-medium">{getUserName(memo.userId)}</span>
                          <span>{format(parseISO(memo.createdAt), 'MM/dd HH:mm')}</span>
                          {canDelete && (
                            <button
                              onClick={() => setMemoToDelete(memo.id)}
                              className="opacity-0 group-hover/memo:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-red-500 rounded"
                              title="削除"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {memoToDelete === memo.id ? (
                          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
                            <div className="flex items-center gap-1.5 text-red-700 mb-2 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              このメッセージを削除しますか？
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => { deleteMemo(memo.id); setMemoToDelete(null); }}
                                className="px-2.5 py-1 bg-red-600 text-white text-xs font-medium rounded hover:bg-red-700"
                              >
                                削除する
                              </button>
                              <button
                                onClick={() => setMemoToDelete(null)}
                                className="px-2.5 py-1 bg-white text-gray-600 border border-gray-300 text-xs font-medium rounded hover:bg-gray-50"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={cn(
                            "px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap",
                            isMine
                              ? "bg-blue-600 text-white rounded-tr-sm"
                              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
                          )}>
                            {memo.content}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Memo Input */}
              <form onSubmit={handleAddMemo} className="mt-auto relative">
                <input
                  type="text"
                  value={newMemo}
                  onChange={(e) => setNewMemo(e.target.value)}
                  placeholder="コメントを入力..."
                  className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!newMemo.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
