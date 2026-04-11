import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { Plus, ArrowLeft, CheckSquare, User, Trash2, Filter, CalendarPlus } from 'lucide-react';

import { GanttChart } from './GanttChart';
import { InitiativeModal } from './InitiativeModal';
import { TaskModal } from './TaskModal';
import { TaskDetailModal } from './TaskDetailModal';
import { cn } from '../lib/utils';

export const Dashboard = () => {
  const { currentUser, categories, initiatives, tasks, users, updateInitiative, archiveInitiative, deleteInitiative, personalSchedules } = useAppContext();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string>(currentUser?.id || 'all');
  const [isInitiativeModalOpen, setIsInitiativeModalOpen] = useState(false);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);
  
  // Edit Initiative State
  const [isEditingInitiative, setIsEditingInitiative] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'incomplete' | 'all'>('incomplete');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editDescription, setEditDescription] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [mainView, setMainView] = useState<'initiatives' | 'unscheduled'>('initiatives');

  // スケジュール未登録タスク（自分担当・未完了・スケジュール未連携）
  const unscheduledTasks = useMemo(() => {
    if (!currentUser) return [];
    return tasks.filter(t => {
      if (t.isCompleted || t.isDeleted) return false;
      if (!t.assigneeIds?.includes(currentUser.id) && t.assigneeId !== currentUser.id) return false;
      // 自分が作成者または参加者のスケジュールにtaskIdが設定されているか確認
      const isScheduled = personalSchedules.some(s =>
        s.taskId === t.id &&
        !s.isArchived &&
        (s.createdBy === currentUser.id || s.participantIds.includes(currentUser.id))
      );
      return !isScheduled;
    });
  }, [tasks, personalSchedules, currentUser]);

  // Filter initiatives based on user role, selected category, and assignee
  const visibleInitiatives = initiatives.filter(init => {
    if (init.isArchived) return false;
    
    const category = categories.find(c => c.id === init.categoryId);
    if (!category) return false;

    // Member cannot see admin-only initiatives
    if (currentUser?.role === 'member' && category.isAdminOnly) {
      return false;
    }

    if (selectedCategoryId !== 'all' && init.categoryId !== selectedCategoryId) {
      return false;
    }

    if (selectedAssigneeId !== 'all') {
      // Filter by assignee: either the initiative itself is assigned, or it has tasks assigned to the user
      const initTasks = tasks.filter(t => t.initiativeId === init.id);
      const isAssignedToInit = init.assigneeIds?.includes(selectedAssigneeId) || init.assigneeId === selectedAssigneeId;
      const hasAssignedTasks = initTasks.some(t => t.assigneeIds?.includes(selectedAssigneeId) || t.assigneeId === selectedAssigneeId);
      if (!isAssignedToInit && !hasAssignedTasks) {
        return false;
      }
    }

    return true;
  });

  const handleInitiativeClick = (id: string) => {
    setSelectedInitiativeId(id);
    const init = initiatives.find(i => i.id === id);
    if (init) {
      setEditTitle(init.title);
      setEditCategoryId(init.categoryId);
    }
    setView('detail');
  };

  const handleSaveInitiative = () => {
    if (selectedInitiativeId && editTitle.trim()) {
      const init = initiatives.find(i => i.id === selectedInitiativeId);
      if (init) {
        updateInitiative(selectedInitiativeId, editTitle.trim(), editCategoryId, init.assigneeIds, init.description);
        setIsEditingInitiative(false);
      }
    }
  };

  const handleSaveDescription = (init: typeof initiatives[0]) => {
    updateInitiative(init.id, init.title, init.categoryId, init.assigneeIds, editDescription);
    setIsEditingDescription(false);
  };

  const handleArchive = () => {
    if (selectedInitiativeId) {
      archiveInitiative(selectedInitiativeId);
      setShowArchiveConfirm(false);
      setView('list');
    }
  };

  const handleDelete = () => {
    if (selectedInitiativeId) {
      deleteInitiative(selectedInitiativeId);
      setShowDeleteConfirm(false);
      setView('list');
    }
  };

  if (view === 'detail' && selectedInitiativeId) {
    const init = initiatives.find(i => i.id === selectedInitiativeId);
    if (!init) {
      setView('list');
      return null;
    }
    return (
      <>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex items-start gap-4">
          <button
            onClick={() => setView('list')}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors mt-1 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            {isEditingInitiative ? (
              <div className="flex flex-col gap-3 mb-2 max-w-2xl">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold text-gray-900 bg-white border border-gray-300 rounded-md px-3 py-1.5 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    setEditTitle(init.title);
                    setEditCategoryId(init.categoryId);
                    setIsEditingInitiative(false);
                  }} className="text-gray-600 bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-md text-sm font-medium transition-colors">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-gray-900 min-w-0 break-all">{init.title}</h2>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium shrink-0 whitespace-nowrap">
                  {categories.find(c => c.id === init.categoryId)?.name || '不明'}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setIsEditingInitiative(true)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="施策を編集"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button
                    onClick={() => setShowArchiveConfirm(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors whitespace-nowrap"
                    title="完了にする"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><rect width="20" height="5" x="2" y="4" rx="2"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/></svg>
                    完了にする
                  </button>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="施策を削除（管理者のみ）"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {showDeleteConfirm && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
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
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md">
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
          </div>
        </div>

        {/* メモ・詳細（タイトルの下・全幅） */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-600 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              メモ・詳細
            </h3>
            <div className="flex items-center gap-2">
              {!isEditingDescription ? (
                <button
                  onClick={() => { setEditDescription(init.description || ''); setIsEditingDescription(true); }}
                  className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                >
                  編集
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingDescription(false)}
                    className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => handleSaveDescription(init)}
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              )}
              {/* タスク追加ボタン */}
              <button
                onClick={() => setIsAddingTask(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 active:scale-95 transition-all"
              >
                <Plus className="w-4 h-4" />
                タスク追加
              </button>
            </div>
          </div>
          <div className="px-4 py-3">
            {isEditingDescription ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder="施策の詳細、背景、参考URLなどを記載できます"
              />
            ) : (
              <div
                onClick={() => { setEditDescription(init.description || ''); setIsEditingDescription(true); }}
                className="min-h-[36px] cursor-pointer rounded-md hover:bg-gray-50 transition-colors"
              >
                {init.description ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{init.description}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">クリックしてメモや詳細を追加できます</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-[500px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          {/* Filter controls inside the Gantt panel header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" />
              タスク表示
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTaskFilter('incomplete')}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                  taskFilter === 'incomplete'
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                未完了のみ
              </button>
              <button
                onClick={() => setTaskFilter('all')}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md font-medium transition-colors",
                  taskFilter === 'all'
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                全て表示
              </button>
            </div>
          </div>
          <GanttChart initiatives={[init]} showInitiativeDetail={false} taskFilter={taskFilter} />
        </div>
      </div>

      {isAddingTask && selectedInitiativeId && (
        <TaskModal initiativeId={selectedInitiativeId} onClose={() => setIsAddingTask(false)} />
      )}
      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
          <h2 className="text-2xl font-bold text-gray-900 shrink-0">ダッシュボード</h2>
          {/* メインビュー切り替え */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMainView('initiatives')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                mainView === 'initiatives' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              施策一覧
            </button>
            <button
              onClick={() => setMainView('unscheduled')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                mainView === 'unscheduled' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              スケジュール未登録
              {unscheduledTasks.length > 0 && (
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                  {unscheduledTasks.length}
                </span>
              )}
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-1.5 pl-3 pr-8 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">すべてのカテゴリー</option>
              {categories
                .filter(c => currentUser?.role === 'admin' || !c.isAdminOnly)
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              }
            </select>
            <select
              value={selectedAssigneeId}
              onChange={(e) => setSelectedAssigneeId(e.target.value)}
              className="w-full sm:w-auto border border-gray-300 rounded-md text-sm py-1.5 pl-3 pr-8 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">すべての担当者</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setIsInitiativeModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center shrink-0"
        >
          <Plus className="w-4 h-4" />
          新規施策
        </button>
      </div>

      {/* スケジュール未登録ビュー */}
      {mainView === 'unscheduled' && (
        <div className="space-y-3">
          {unscheduledTasks.length === 0 ? (
            <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
              <CalendarPlus className="w-10 h-10 mx-auto mb-3 opacity-40" />
              スケジュール未登録のタスクはありません。
            </div>
          ) : (
            unscheduledTasks.map(task => {
              const init = initiatives.find(i => i.id === task.initiativeId);
              return (
                <div
                  key={task.id}
                  className="bg-white px-4 py-3 rounded-xl border border-gray-200 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{task.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">施策: {init?.title || '不明'} ／ 期限: {task.endDate.replace(/-/g, '/')}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setSelectedTaskId(task.id)}
                      className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      詳細
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {mainView === 'initiatives' && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleInitiatives.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
            表示できる施策がありません。
          </div>
        ) : (
          visibleInitiatives.map(init => {
            const initTasks = tasks.filter(t => t.initiativeId === init.id);
            const completedTasks = initTasks.filter(t => t.isCompleted).length;
            const progress = initTasks.length === 0 ? 0 : Math.round((completedTasks / initTasks.length) * 100);
            const assignees = users.filter(u => init.assigneeIds?.includes(u.id) || init.assigneeId === u.id);

            return (
              <div 
                key={init.id} 
                onClick={() => handleInitiativeClick(init.id)}
                className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">{init.title}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                    {categories.find(c => c.id === init.categoryId)?.name}
                  </span>
                  {assignees.length > 0 && (
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {assignees.map(a => a.name).join(', ')}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span className="flex items-center gap-1"><CheckSquare className="w-4 h-4" /> {completedTasks}/{initTasks.length} タスク</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>)}

      {isInitiativeModalOpen && (
        <InitiativeModal onClose={() => setIsInitiativeModalOpen(false)} />
      )}
    </div>
  );
};
