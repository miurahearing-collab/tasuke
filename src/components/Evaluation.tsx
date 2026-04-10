import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export const Evaluation = () => {
  const { users, initiatives, tasks, currentUser } = useAppContext();
  
  // Default to current month
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  if (currentUser?.role !== 'admin') {
    return <div className="p-8 text-center text-red-500">アクセス権限がありません。</div>;
  }

  const evaluationData = useMemo(() => {
    if (!startDate || !endDate) return [];

    const start = parseISO(startDate);
    const end = parseISO(endDate);

    return users.map(user => {
      // Initiatives assigned to user created within the period
      const userInitiatives = initiatives.filter(i => {
        if (!(i.assigneeIds?.includes(user.id) || i.assigneeId === user.id)) return false;
        const createdAt = parseISO(i.createdAt);
        return isWithinInterval(createdAt, { start, end });
      });

      const completedInitiatives = userInitiatives.filter(i => i.isArchived).length;
      const totalInitiatives = userInitiatives.length;

      // Tasks assigned to user with end date within the period
      const userTasks = tasks.filter(t => {
        if (!(t.assigneeIds?.includes(user.id) || t.assigneeId === user.id)) return false;
        const taskEnd = parseISO(t.endDate);
        return isWithinInterval(taskEnd, { start, end });
      });

      const completedTasks = userTasks.filter(t => t.isCompleted).length;
      const totalTasks = userTasks.length;

      return {
        user,
        initiatives: { completed: completedInitiatives, total: totalInitiatives },
        tasks: { completed: completedTasks, total: totalTasks }
      };
    });
  }, [users, initiatives, tasks, startDate, endDate]);

  const setLastMonth = () => {
    const lastMonth = subMonths(new Date(), 1);
    setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
  };

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">評価ダッシュボード</h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={setLastMonth} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-md">先月</button>
            <button onClick={setThisMonth} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-md">今月</button>
          </div>
          <div className="hidden sm:block w-px h-6 bg-gray-200"></div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="text-gray-500">〜</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">ユーザー</th>
                <th className="px-6 py-4">施策達成状況</th>
                <th className="px-6 py-4">タスク達成状況</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evaluationData.map(data => {
                const initProgress = data.initiatives.total === 0 ? 0 : Math.round((data.initiatives.completed / data.initiatives.total) * 100);
                const taskProgress = data.tasks.total === 0 ? 0 : Math.round((data.tasks.completed / data.tasks.total) * 100);

                return (
                  <tr key={data.user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {data.user.name}
                      {data.user.role === 'admin' && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">管理者</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-[200px]">
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${initProgress}%` }}></div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 w-24">
                          {data.initiatives.completed} / {data.initiatives.total} ({initProgress}%)
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-1 max-w-[200px]">
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${taskProgress}%` }}></div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 w-24">
                          {data.tasks.completed} / {data.tasks.total} ({taskProgress}%)
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
