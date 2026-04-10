import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import { RotateCcw, Trash2, Calendar } from 'lucide-react';

export const Archive = () => {
  const { currentUser, categories, initiatives, tasks, unarchiveInitiative, deleteInitiative, meetingPolls, restoreMeetingPoll, deleteMeetingPoll } = useAppContext();
  const [activeTab, setActiveTab] = useState<'initiatives' | 'polls'>('initiatives');
  const [pollToDelete, setPollToDelete] = useState<string | null>(null);
  const [initiativeToDelete, setInitiativeToDelete] = useState<string | null>(null);

  // Filter archived initiatives based on user role
  const archivedInitiatives = initiatives.filter(init => {
    if (!init.isArchived) return false;
    
    const category = categories.find(c => c.id === init.categoryId);
    if (!category) return false;

    // Member cannot see admin-only initiatives
    if (currentUser?.role === 'member' && category.isAdminOnly) {
      return false;
    }

    return true;
  });

  const deletedPolls = meetingPolls.filter(p => p.isDeleted);

  const getCategoryName = (catId: string) => categories.find(c => c.id === catId)?.name || '不明';
  const getTasksForInitiative = (initId: string) => tasks.filter(t => t.initiativeId === initId);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">アーカイブ・ゴミ箱</h2>
      </div>

      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('initiatives')}
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'initiatives' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          完了した施策 ({archivedInitiatives.length})
        </button>
        <button
          onClick={() => setActiveTab('polls')}
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'polls' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          削除した日程調整 ({deletedPolls.length})
        </button>
      </div>

      {activeTab === 'initiatives' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {archivedInitiatives.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              完了済みの施策はありません。
            </div>
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
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            タスク達成率
                          </div>
                          <div className="text-2xl font-bold text-blue-600">
                            {initTasks.length > 0 ? Math.round((completedTasks / initTasks.length) * 100) : 0}%
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => unarchiveInitiative(init.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            title="ダッシュボードに戻す"
                          >
                            <RotateCcw className="w-4 h-4" />
                            元に戻す
                          </button>
                          <button
                            onClick={() => setInitiativeToDelete(init.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                            title="完全に削除"
                          >
                            <Trash2 className="w-4 h-4" />
                            完全に削除
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {initiativeToDelete === init.id && (
                      <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800 mb-3">この施策と関連するすべてのタスクを完全に削除しますか？この操作は取り消せません。</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              deleteInitiative(init.id);
                              setInitiativeToDelete(null);
                            }}
                            className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
                          >
                            削除する
                          </button>
                          <button
                            onClick={() => setInitiativeToDelete(null)}
                            className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50"
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    )}
                    {initTasks.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">タスク一覧</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {initTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between gap-2 text-sm bg-white p-2 rounded border border-gray-100">
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  task.isCompleted ? "bg-green-500" : "bg-gray-300"
                                )} />
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

      {activeTab === 'polls' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {deletedPolls.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              ゴミ箱にある日程調整はありません。
            </div>
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
                      <button
                        onClick={() => setPollToDelete(poll.id)}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        完全に削除
                      </button>
                    </div>
                  </div>
                  {pollToDelete === poll.id && (
                    <div className="p-4 bg-red-50 border-t border-red-100">
                      <p className="text-sm text-red-800 mb-3">完全に削除しますか？この操作は取り消せません。</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            deleteMeetingPoll(poll.id);
                            setPollToDelete(null);
                          }} 
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
