import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { X, Check, Plus, Calendar as CalendarIcon, MessageSquare, Archive as ArchiveIcon, User, Save, Pencil, Trash2, ArrowUpDown, SortAsc } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';

export const InitiativeDetailModal = ({ initiativeId, onClose }: { initiativeId: string, onClose: () => void }) => {
  const { initiatives, categories, tasks, memos, users, currentUser, toggleTaskCompletion, updateInitiative, archiveInitiative, deleteInitiative } = useAppContext();
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [isEditingInitiative, setIsEditingInitiative] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskSortOrder, setTaskSortOrder] = useState<'deadline' | 'start'>('deadline');
  const [showCompleted, setShowCompleted] = useState(false);

  const initiative = initiatives.find(i => i.id === initiativeId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initiative?.assigneeIds || []);
  const [editTitle, setEditTitle] = useState(initiative?.title || '');
  const [editCategoryId, setEditCategoryId] = useState(initiative?.categoryId || '');

  if (!initiative) return null;

  const category = categories.find(c => c.id === initiative.categoryId);

  // Sort: deadline nearest first, completed last
  const allInitTasks = tasks.filter(t => t.initiativeId === initiativeId).sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (taskSortOrder === 'deadline') {
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const initTasks = showCompleted ? allInitTasks : allInitTasks.filter(t => !t.isCompleted);

  const completedCount = tasks.filter(t => t.initiativeId === initiativeId && t.isCompleted).length;
  const totalCount = tasks.filter(t => t.initiativeId === initiativeId).length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const handleSaveAssignee = () => {
    updateInitiative(initiativeId, initiative.title, initiative.categoryId, assigneeIds);
    setIsEditingAssignee(false);
  };

  const handleSaveInitiative = () => {
    if (editTitle.trim()) {
      updateInitiative(initiativeId, editTitle.trim(), editCategoryId, assigneeIds);
      setIsEditingInitiative(false);
    }
  };

  const handleArchive = () => {
    archiveInitiative(initiativeId);
    onClose();
  };

  const handleDelete = () => {
    deleteInitiative(initiativeId);
    onClose();
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const getUserName = (userId?: string) => users.find(u => u.id === userId)?.name;
  const getAssigneeNames = (ids?: string[], fallbackId?: string) => {
    if (ids && ids.length > 0) {
      return ids.map(id => getUserName(id)).filter(Boolean).join(', ');
    }
    if (fallbackId) return getUserName(fallbackId);
    return '未設定';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between bg-gray-50">
          <div className="flex-1 mr-4">
            {isEditingInitiative ? (
              <div className="flex flex-col gap-3 mb-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-xl font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="施策のタイトル"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">カテゴリなし</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <button onClick={handleSaveInitiative} className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-md text-sm font-medium transition-colors">
                    保存
                  </button>
                  <button onClick={() => {
                    setEditTitle(initiative.title);
                    setEditCategoryId(initiative.categoryId);
                    setIsEditingInitiative(false);
                  }} className="text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-md text-sm font-medium transition-colors">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h2 className="text-xl font-bold text-gray-900">{initiative.title}</h2>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                    {category?.name || '不明'}
                  </span>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => setIsEditingInitiative(true)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="施策を編集"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowArchiveConfirm(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                      title="完了にする"
                    >
                      <ArchiveIcon className="w-3.5 h-3.5" />
                      完了にする
                    </button>
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-1"
                        title="施策を削除（管理者のみ）"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {showDeleteConfirm && (
                  <div className="mt-4 mb-2 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
                    <p className="text-sm text-red-800 mb-3">この施策と関連するすべてのタスクを削除してもよろしいですか？</p>
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

                {showArchiveConfirm && (
                  <div className="mt-4 mb-2 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md">
                    <p className="text-sm text-green-800 mb-3">この施策を完了（アーカイブ）しますか？</p>
                    <div className="flex gap-2">
                      <button onClick={handleArchive} className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700">
                        完了にする
                      </button>
                      <button onClick={() => setShowArchiveConfirm(false)} className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50">
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}

                <div className="text-sm text-gray-500 flex items-center gap-4 flex-wrap mt-1">
                  <span>作成日: {format(parseISO(initiative.createdAt), 'yyyy/MM/dd')}</span>
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
                        <button onClick={() => { setAssigneeIds(initiative.assigneeIds || []); setIsEditingAssignee(false); }} className="text-gray-500 hover:text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">キャンセル</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{getAssigneeNames(initiative.assigneeIds, initiative.assigneeId)}</span>
                        <button onClick={() => setIsEditingAssignee(true)} className="text-blue-600 hover:text-blue-800 text-xs">変更</button>
                      </div>
                    )}
                  </div>
                  {/* Creator info */}
                  {initiative.createdBy && (
                    <span className="text-xs text-gray-400">
                      作成者: <span className="font-medium text-gray-600">{getUserName(initiative.createdBy)}</span>
                    </span>
                  )}
                  {/* Last updater info */}
                  {initiative.updatedBy && (
                    <span className="text-xs text-gray-400">
                      最終更新: <span className="font-medium text-gray-600">{getUserName(initiative.updatedBy)}</span>
                    </span>
                  )}
                  {/* Completed by */}
                  {initiative.isArchived && initiative.completedBy && (
                    <span className="text-xs text-green-600">
                      完了者: <span className="font-medium">{getUserName(initiative.completedBy)}</span>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsAddingTask(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              タスク追加
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 relative">
          <div className="mb-6 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">進捗状況</h3>
              <span className="text-sm font-bold text-blue-600">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="mt-2 text-xs text-gray-500 text-right">
              {completedCount} / {totalCount} タスク完了
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">タスク一覧</h3>
            <div className="flex items-center gap-2">
              {/* Sort toggle */}
              <button
                onClick={() => setTaskSortOrder(prev => prev === 'deadline' ? 'start' : 'deadline')}
                className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-md transition-colors"
                title="ソート切替"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{taskSortOrder === 'deadline' ? '期限順' : '開始順'}</span>
              </button>
              {/* Show/hide completed */}
              <button
                onClick={() => setShowCompleted(prev => !prev)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors",
                  showCompleted
                    ? "text-green-700 bg-green-50 border-green-200 hover:bg-green-100"
                    : "text-gray-600 bg-white border-gray-200 hover:bg-gray-50"
                )}
              >
                <SortAsc className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{showCompleted ? '完了含む' : '未完了のみ'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {initTasks.map(task => {
              const taskMemos = memos.filter(m => m.taskId === task.id);
              const unreadCount = taskMemos.filter(m => {
                if (m.userId === currentUser?.id) return false;
                const lastRead = task.readStatus?.[currentUser?.id || ''];
                if (!lastRead) return true;
                return new Date(m.createdAt) > new Date(lastRead);
              }).length;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "bg-white border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer",
                    task.isCompleted ? "border-gray-200 bg-gray-50/50" : "border-gray-200"
                  )}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskCompletion(task.id);
                      }}
                      className={cn(
                        "mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        task.isCompleted
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "border-gray-300 hover:border-blue-500 text-transparent hover:text-blue-200"
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "text-base font-medium mb-1 truncate",
                        task.isCompleted ? "text-gray-500 line-through" : "text-gray-900"
                      )}>
                        {task.title}
                        {task.recurringType && task.recurringType !== 'none' && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded font-medium">繰返</span>
                        )}
                      </h4>
                      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {format(parseISO(task.startDate), 'MM/dd')} - {format(parseISO(task.endDate), 'MM/dd')}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {getAssigneeNames(task.assigneeIds, task.assigneeId)}
                        </div>
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {taskMemos.length}
                          {unreadCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] font-bold">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        {/* Creator/updater info */}
                        {task.createdBy && (
                          <span className="text-gray-400">
                            作成: {getUserName(task.createdBy)}
                          </span>
                        )}
                        {task.isCompleted && task.completedBy && (
                          <span className="text-green-600">
                            完了: {getUserName(task.completedBy)}
                          </span>
                        )}
                        {!task.isCompleted && task.updatedBy && (
                          <span className="text-gray-400">
                            更新: {getUserName(task.updatedBy)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {allInitTasks.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border border-gray-200 border-dashed">
                タスクがありません。「タスク追加」から新しいタスクを作成してください。
              </div>
            )}
            {allInitTasks.length > 0 && initTasks.length === 0 && !showCompleted && (
              <div className="text-center py-6 text-gray-400 bg-white rounded-lg border border-gray-200 border-dashed text-sm">
                未完了タスクはありません。
                <button onClick={() => setShowCompleted(true)} className="ml-2 text-blue-600 hover:underline">完了済みを表示</button>
              </div>
            )}
          </div>
        </div>

      </div>

      {isAddingTask && (
        <TaskModal
          initiativeId={initiativeId}
          onClose={() => setIsAddingTask(false)}
        />
      )}

      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  );
};
