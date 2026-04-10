import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { RotateCcw, Trash2, Calendar } from 'lucide-react';

type Tab = 'archivedInitiatives' | 'deletedInitiatives' | 'deletedTasks' | 'polls';

export const Archive = () => {
  const {
    currentUser, categories, initiatives, deletedInitiatives,
    tasks, deletedTasks,
    users, memos,
    unarchiveInitiative, restoreInitiative, permanentDeleteInitiative,
    restoreTask, permanentDeleteTask,
    meetingPolls, restoreMeetingPoll, deleteMeetingPoll,
  } = useAppContext();

  const [activeTab, setActiveTab] = useState<Tab>('archivedInitiatives');
  const [confirmTarget, setConfirmTarget] = useState<{ type: string; id: string } | null>(null);
  const [pollToDelete, setPollToDelete] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  // 完了した施策 (archived, not deleted)
  const archivedInitiatives = initiatives.filter(i => {
    if (!i.isArchived) return false;
    const category = categories.find(c => c.id === i.categoryId);
    if (!category) return false;
    if (!isAdmin && category.isAdminOnly) return false;
    return true;
  });

  // 削除した施策
  const filteredDeletedInitiatives = deletedInitiatives.filter(i => {
    const category = categories.find(c => c.id === i.categoryId);
    if (!category) return true; // show even if category is missing
    if (!isAdmin && category.isAdminOnly) return false;
    return true;
  });

  // 削除した日程調整
  const deletedPolls = meetingPolls.filter(p => p.isDeleted);

  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || '不明';
  const getUserName = (uid?: string) => users.find(u => u.id === uid)?.name || '不明';
  const getTasksForInitiative = (initId: string) => tasks.filter(t => t.initiativeId === initId);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'archivedInitiatives', label: '完了した施策', count: archivedInitiatives.length },
    { id: 'deletedInitiatives', label: '削除した施策', count: filteredDeletedInitiatives.length },
    { id: 'deletedTasks', label: '削除したタスク', count: deletedTasks.length },
    { id: 'polls', label: '削除した日程調整', count: deletedPolls.length },
  ];

  const ConfirmDialog = ({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) => (
    <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-800 mb-3">{message}</p>
      <div className="flex gap-2">
        <button onClick={onConfirm} className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700">
          削除する
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50">
          キャンセル
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">アーカイブ・ゴミ箱</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 px-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.label}
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 rounded-full text-xs",
              activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── 完了した施策 ── */}
      {activeTab === 'archivedInitiatives' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {archivedInitiatives.length === 0 ? (
            <div className="p-12 text-center text-gray-500">完了済みの施策はありません。</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {archivedInitiatives.map(init => {
                const initTasks = getTasksForInitiative(init.id);
                const completedTasks = initTasks.filter(t => t.isCompleted).length;
                return (
                  <div key={init.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{init.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                            {getCategoryName(init.categoryId)}
                          </span>
                          <span>作成日: {format(parseISO(init.createdAt), 'yyyy/MM/dd')}</span>
                          {init.completedBy && (
                            <span>完了者: {getUserName(init.completedBy)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">タスク達成率</div>
                          <div className="text-2xl font-bold text-blue-600">
                            {initTasks.length > 0 ? Math.round((completedTasks / initTasks.length) * 100) : 0}%
                          </div>
                        </div>
                        <button
                          onClick={() => unarchiveInitiative(init.id)}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          title="ダッシュボードに戻す"
                        >
                          <RotateCcw className="w-4 h-4" />
                          元に戻す
                        </button>
                      </div>
                    </div>
                    {initTasks.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">タスク一覧</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {initTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between gap-2 text-sm bg-white p-2 rounded border border-gray-100">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", task.isCompleted ? "bg-green-500" : "bg-gray-300")} />
                                <span className={cn("truncate", task.isCompleted ? "text-gray-500 line-through" : "text-gray-700")}>
                                  {task.title}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                                <Calendar className="w-3 h-3" />
                                {task.endDate.replace(/-/g, '/')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 削除した施策 ── */}
      {activeTab === 'deletedInitiatives' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredDeletedInitiatives.length === 0 ? (
            <div className="p-12 text-center text-gray-500">削除した施策はありません。</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredDeletedInitiatives.map(init => (
                <React.Fragment key={init.id}>
                  <div className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{init.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="px-2.5 py-0.5 bg-gray-100 rounded-full text-xs font-medium text-gray-600">
                            {getCategoryName(init.categoryId)}
                          </span>
                          <span>作成日: {format(parseISO(init.createdAt), 'yyyy/MM/dd')}</span>
                          {init.deletedAt && (
                            <span>削除日: {format(parseISO(init.deletedAt), 'yyyy/MM/dd')}</span>
                          )}
                          {init.deletedBy && (
                            <span>削除者: {getUserName(init.deletedBy)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => restoreInitiative(init.id)}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                          元に戻す
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmTarget({ type: 'initiative', id: init.id })}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            完全に削除
                          </button>
                        )}
                      </div>
                    </div>
                    {confirmTarget?.type === 'initiative' && confirmTarget.id === init.id && (
                      <ConfirmDialog
                        message="この施策と関連するすべてのタスクを完全に削除しますか？この操作は取り消せません。"
                        onConfirm={() => { permanentDeleteInitiative(init.id); setConfirmTarget(null); }}
                        onCancel={() => setConfirmTarget(null)}
                      />
                    )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 削除したタスク ── */}
      {activeTab === 'deletedTasks' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {deletedTasks.length === 0 ? (
            <div className="p-12 text-center text-gray-500">削除したタスクはありません。</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {deletedTasks.map(task => {
                const initiative = [...(initiatives || []), ...(deletedInitiatives || [])].find(i => i.id === task.initiativeId);
                const assigneeNames = task.assigneeIds?.map(id => getUserName(id)).filter(Boolean).join(', ') || '未設定';
                return (
                  <React.Fragment key={task.id}>
                    <div className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-1">{task.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                            <span>施策: {initiative?.title || '（施策も削除済み）'}</span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {task.endDate.replace(/-/g, '/')}
                            </span>
                            <span>担当: {assigneeNames}</span>
                            {task.deletedAt && (
                              <span>削除日: {format(parseISO(task.deletedAt), 'yyyy/MM/dd')}</span>
                            )}
                            {task.deletedBy && (
                              <span>削除者: {getUserName(task.deletedBy)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => restoreTask(task.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            元に戻す
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmTarget({ type: 'task', id: task.id })}
                              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              完全に削除
                            </button>
                          )}
                        </div>
                      </div>
                      {confirmTarget?.type === 'task' && confirmTarget.id === task.id && (
                        <ConfirmDialog
                          message="このタスクを完全に削除しますか？この操作は取り消せません。"
                          onConfirm={() => { permanentDeleteTask(task.id); setConfirmTarget(null); }}
                          onCancel={() => setConfirmTarget(null)}
                        />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 削除した日程調整 ── */}
      {activeTab === 'polls' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {deletedPolls.length === 0 ? (
            <div className="p-12 text-center text-gray-500">ゴミ箱にある日程調整はありません。</div>
          ) : (
            <div className="divide-y divide-gray-200">
              {deletedPolls.map(poll => (
                <React.Fragment key={poll.id}>
                  <div className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{poll.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          作成日: {format(parseISO(poll.createdAt), 'yyyy/MM/dd')}
                        </span>
                        {poll.deletedAt && (
                          <span>削除日: {format(parseISO(poll.deletedAt), 'yyyy/MM/dd')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreMeetingPoll(poll.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" />
                        元に戻す
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setPollToDelete(poll.id)}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          完全に削除
                        </button>
                      )}
                    </div>
                  </div>
                  {pollToDelete === poll.id && (
                    <div className="p-4 bg-red-50 border-t border-red-100">
                      <p className="text-sm text-red-800 mb-3">完全に削除しますか？この操作は取り消せません。</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { deleteMeetingPoll(poll.id); setPollToDelete(null); }}
                          className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
                        >
                          削除する
                        </button>
                        <button
                          onClick={() => setPollToDelete(null)}
                          className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50"
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
