import React, { useMemo, useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { parseISO, startOfDay, addDays, format, isAfter, isBefore } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AlertCircle, Clock, ChevronDown, ChevronUp, Briefcase, ListTodo } from 'lucide-react';
import { cn } from '../lib/utils';
import { TaskDetailModal } from './TaskDetailModal';
import { InitiativeDetailModal } from './InitiativeDetailModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

type SortKey = 'overdue' | 'incomplete' | 'name';
type FilterKey = 'all' | 'hasOverdue' | 'hasTask';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
];

export const MemberAnalysis = () => {
  const { currentUser, users, tasks, initiatives, categories, appSettings } = useAppContext();

  const [sortBy, setSortBy] = useState<SortKey>('overdue');
  const [filterBy, setFilterBy] = useState<FilterKey>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);

  // アクセス制御
  if (currentUser?.role !== 'admin' && !appSettings.memberAnalysisAllowedUserIds.includes(currentUser?.id ?? '')) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        アクセス権限がありません。
      </div>
    );
  }

  const today = startOfDay(new Date());
  const threeDaysLater = addDays(today, 3);

  const memberData = useMemo(() => {
    return users.map((user, idx) => {
      const userTasks = tasks.filter(
        t => !t.isDeleted && (t.assigneeIds?.includes(user.id))
      );
      const incompleteTasks = userTasks
        .filter(t => !t.isCompleted)
        .sort((a, b) => a.endDate.localeCompare(b.endDate));

      const overdueTasks = incompleteTasks.filter(
        t => isBefore(startOfDay(parseISO(t.endDate)), today)
      );
      const dueSoonTasks = incompleteTasks.filter(t => {
        const end = startOfDay(parseISO(t.endDate));
        return !isBefore(end, today) && !isAfter(end, threeDaysLater);
      });
      const activeInitiatives = initiatives.filter(
        i => !i.isDeleted && !i.isArchived && (i.assigneeIds?.includes(user.id))
      );

      return {
        user,
        avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
        totalTasks: userTasks.length,
        incompleteTasks,
        incompleteCount: incompleteTasks.length,
        overdueCount: overdueTasks.length,
        dueSoonCount: dueSoonTasks.length,
        activeInitiatives,
      };
    });
  }, [users, tasks, initiatives, today]);

  const displayedData = useMemo(() => {
    let data = [...memberData];

    // フィルタ
    if (filterBy === 'hasOverdue') data = data.filter(d => d.overdueCount > 0);
    if (filterBy === 'hasTask') data = data.filter(d => d.incompleteCount > 0);

    // ソート
    data.sort((a, b) => {
      if (sortBy === 'overdue') return b.overdueCount - a.overdueCount || b.incompleteCount - a.incompleteCount;
      if (sortBy === 'incomplete') return b.incompleteCount - a.incompleteCount;
      return a.user.name.localeCompare(b.user.name, 'ja');
    });

    return data;
  }, [memberData, sortBy, filterBy]);

  const toggleCard = (userId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const getInitiativeName = (initiativeId: string) => {
    return initiatives.find(i => i.id === initiativeId)?.title ?? '';
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name ?? '';
  };

  const getTaskStatus = (endDate: string) => {
    const end = startOfDay(parseISO(endDate));
    if (isBefore(end, today)) return 'overdue';
    if (!isAfter(end, threeDaysLater)) return 'dueSoon';
    return 'normal';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">メンバー分析</h2>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{users.length}名</span>
        </div>
      </div>

      {/* フィルタ・ソートバー */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
          {([
            ['all', '全員'],
            ['hasOverdue', '期限切れあり'],
            ['hasTask', '未完了あり'],
          ] as [FilterKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterBy(key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                filterBy === key ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>並び替え:</span>
          {([
            ['overdue', '期限切れ順'],
            ['incomplete', '未完了数順'],
            ['name', '名前順'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={cn(
                'px-2.5 py-1 rounded-md border transition-colors',
                sortBy === key
                  ? 'border-green-500 text-green-700 bg-green-50'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50 bg-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* チャートセクション */}
      {displayedData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700">メンバー別タスク状況</h3>

          {/* タスク内訳 積み上げ棒グラフ */}
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={displayedData.map(d => ({
                name: d.user.name,
                期限切れ: d.overdueCount,
                期限3日以内: d.dueSoonCount,
                通常未完了: d.incompleteCount - d.overdueCount - d.dueSoonCount,
              }))}
              margin={{ top: 4, right: 16, left: -20, bottom: 56 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-40}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(value: number, name: string) => [`${value}件`, name]}
              />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 12 }} />
              <Bar dataKey="期限切れ" stackId="a" fill="#ef4444" />
              <Bar dataKey="期限3日以内" stackId="a" fill="#f59e0b" />
              <Bar dataKey="通常未完了" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* メンバーカードグリッド */}
      {displayedData.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          条件に一致するメンバーがいません
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {displayedData.map(({
            user, avatarColor,
            incompleteTasks, incompleteCount, overdueCount, dueSoonCount,
            activeInitiatives
          }) => {
            const isExpanded = expandedCards.has(user.id);
            const PREVIEW_COUNT = 5;
            const visibleTasks = isExpanded ? incompleteTasks : incompleteTasks.slice(0, PREVIEW_COUNT);
            const hasMore = incompleteTasks.length > PREVIEW_COUNT;

            return (
              <div
                key={user.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* カードヘッダー */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0', avatarColor)}>
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{user.name}</span>
                      {user.role === 'admin' && (
                        <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">管理者</span>
                      )}
                    </div>
                    {user.email && (
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4">
                  {/* KPI バッジ行 */}
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg">
                      <ListTodo className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-xs text-gray-600 font-medium">未完了</span>
                      <span className="text-sm font-bold text-gray-800">{incompleteCount}件</span>
                    </div>
                    {overdueCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-xs text-red-600 font-medium">期限切れ</span>
                        <span className="text-sm font-bold text-red-700">{overdueCount}件</span>
                      </div>
                    )}
                    {dueSoonCount > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-lg border border-yellow-100">
                        <Clock className="w-3.5 h-3.5 text-yellow-500" />
                        <span className="text-xs text-yellow-700 font-medium">3日以内</span>
                        <span className="text-sm font-bold text-yellow-800">{dueSoonCount}件</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
                      <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs text-blue-700 font-medium">担当施策</span>
                      <span className="text-sm font-bold text-blue-800">{activeInitiatives.length}件</span>
                    </div>
                  </div>

                  {/* 担当施策リスト */}
                  {activeInitiatives.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">担当施策</p>
                      <div className="flex flex-wrap gap-1.5">
                        {activeInitiatives.map(ini => (
                          <button
                            key={ini.id}
                            onClick={() => setSelectedInitiativeId(ini.id)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-gray-700 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                            title={getCategoryName(ini.categoryId)}
                          >
                            {ini.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* タスク一覧 */}
                  {incompleteTasks.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1.5">未完了タスク</p>
                      <div className="space-y-1">
                        {visibleTasks.map(task => {
                          const status = getTaskStatus(task.endDate);
                          const initiativeName = getInitiativeName(task.initiativeId);
                          return (
                            <button
                              key={task.id}
                              onClick={() => setSelectedTaskId(task.id)}
                              className={cn(
                                'w-full flex items-start gap-2 px-3 py-2 rounded-lg text-sm text-left transition-opacity hover:opacity-75',
                                status === 'overdue' ? 'bg-red-50' :
                                status === 'dueSoon' ? 'bg-yellow-50' : 'bg-gray-50'
                              )}
                            >
                              <span className={cn(
                                'mt-0.5 w-2 h-2 rounded-full shrink-0',
                                status === 'overdue' ? 'bg-red-500' :
                                status === 'dueSoon' ? 'bg-yellow-400' : 'bg-gray-300'
                              )} />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 leading-snug truncate">{task.title}</p>
                                {initiativeName && (
                                  <p className="text-xs text-gray-400 truncate">{initiativeName}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className={cn(
                                  'text-xs font-medium whitespace-nowrap',
                                  status === 'overdue' ? 'text-red-600' :
                                  status === 'dueSoon' ? 'text-yellow-600' : 'text-gray-400'
                                )}>
                                  {format(parseISO(task.endDate), 'M/d(E)', { locale: ja })}
                                </span>
                                {status === 'overdue' && (
                                  <p className="text-xs text-red-400">期限切れ</p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {hasMore && (
                        <button
                          onClick={() => toggleCard(user.id)}
                          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <><ChevronUp className="w-3.5 h-3.5" />閉じる</>
                          ) : (
                            <><ChevronDown className="w-3.5 h-3.5" />残り{incompleteTasks.length - PREVIEW_COUNT}件を表示</>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-2">未完了タスクはありません</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedTaskId && (
        <TaskDetailModal taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      )}
      {selectedInitiativeId && (
        <InitiativeDetailModal initiativeId={selectedInitiativeId} onClose={() => setSelectedInitiativeId(null)} />
      )}
    </div>
  );
};
