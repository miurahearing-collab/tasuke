import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store/AppContext';
import { LayoutDashboard, Calendar, Clock, CheckSquare, AlertCircle, AlertTriangle, MessageSquare, ArrowUpDown, SortAsc, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { differenceInDays, parseISO, startOfDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { TaskDetailModal } from './TaskDetailModal';
import { VoteStatus } from '../types';

interface HomeProps {
  setCurrentScreen: (screen: 'dashboard' | 'archive' | 'settings' | 'meeting' | 'reservation' | 'home' | 'evaluation') => void;
}

// Parse option string like "2024/04/10 10:00-11:00"
const parseOptionStr = (option: string) => {
  const match = option.match(/^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, sh, sm, eh, em] = match;
  const dateStr = `${year}/${month}/${day}`;
  const startDateTime = new Date(Number(year), Number(month) - 1, Number(day), Number(sh), Number(sm));
  const endDateTime = new Date(Number(year), Number(month) - 1, Number(day), Number(eh), Number(em));
  return { dateStr, startDateTime, endDateTime, startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` };
};

export const Home = ({ setCurrentScreen }: HomeProps) => {
  const { currentUser, initiatives, tasks, memos, meetingPolls, categories, voteMeetingPoll } = useAppContext();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskSortOrder, setTaskSortOrder] = useState<'deadline' | 'start'>('deadline');
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  if (!currentUser) return null;

  const today = startOfDay(new Date());

  // Today's week range (Monday–Sunday)
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

  // 今週のタスク: startDate falls within this week, assigned to me
  const allMyTasks = tasks.filter(t =>
    t.assigneeIds?.includes(currentUser.id) || t.assigneeId === currentUser.id
  );

  const weekTasks = allMyTasks.filter(t => {
    const start = parseISO(t.startDate);
    return isWithinInterval(start, { start: weekStart, end: weekEnd });
  });

  const sortedWeekTasks = [...weekTasks].sort((a, b) => {
    // Completed tasks always go last
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    if (taskSortOrder === 'deadline') {
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const displayedWeekTasks = showCompletedTasks
    ? sortedWeekTasks
    : sortedWeekTasks.filter(t => !t.isCompleted);

  // My Initiatives
  const myInitiatives = initiatives.filter(i =>
    !i.isArchived &&
    (i.assigneeIds?.includes(currentUser.id) || i.assigneeId === currentUser.id || tasks.some(t => t.initiativeId === i.id && (t.assigneeIds?.includes(currentUser.id) || t.assigneeId === currentUser.id)))
  );

  // Confirmed meetings where I'm a target member, upcoming only, max 3
  const confirmedMeetings = useMemo(() => {
    return meetingPolls
      .filter(p => !p.isDeleted && p.confirmedOption && p.targetUserIds.includes(currentUser.id))
      .map(p => {
        const parsed = parseOptionStr(p.confirmedOption!);
        if (!parsed) return null;
        return { poll: p, ...parsed };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null && startOfDay(m.startDateTime) >= today)
      .sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime())
      .slice(0, 3);
  }, [meetingPolls, currentUser.id, today]);

  // Unanswered Meeting Polls
  const unansweredPolls = meetingPolls.filter(poll => {
    if (poll.isDeleted) return false;
    if (!poll.targetUserIds.includes(currentUser.id)) return false;
    const myVoteCount = Object.keys(poll.votes[currentUser.id] || {}).length;
    return myVoteCount < poll.options.length;
  });

  // Urgent Tasks (Deadline within 3 days or overdue, incomplete, assigned to me)
  const urgentTasks = allMyTasks.filter(t => {
    if (t.isCompleted) return false;
    const daysLeft = differenceInDays(parseISO(t.endDate), today);
    return daysLeft <= 3;
  }).sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());

  // Tasks with unread memos (incomplete, assigned to me)
  const unreadTasks = allMyTasks.filter(task => {
    if (task.isCompleted) return false;
    return memos.some(m =>
      m.taskId === task.id &&
      m.userId !== currentUser.id &&
      (!task.readStatus?.[currentUser.id] || new Date(m.createdAt) > new Date(task.readStatus[currentUser.id]))
    );
  });

  const incompletedCount = weekTasks.filter(t => !t.isCompleted).length;
  const completedCount = weekTasks.filter(t => t.isCompleted).length;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">こんにちは、{currentUser.name}さん</h2>
        <p className="text-gray-500">本日のタスクと予定を確認しましょう。</p>
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <button
          onClick={() => setCurrentScreen('dashboard')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-3 group p-2 sm:p-6"
        >
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <LayoutDashboard className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <span className="font-medium text-gray-900 text-[10px] sm:text-base leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">ダッシュボード</span>
        </button>
        <button
          onClick={() => setCurrentScreen('meeting')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-3 group p-2 sm:p-6"
        >
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <Calendar className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <span className="font-medium text-gray-900 text-[10px] sm:text-base leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">スケジューラー</span>
        </button>
        <button
          onClick={() => setCurrentScreen('reservation')}
          className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col items-center justify-center gap-1.5 sm:gap-3 group p-2 sm:p-6"
        >
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
            <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <span className="font-medium text-gray-900 text-[10px] sm:text-base leading-tight text-center whitespace-nowrap overflow-hidden text-ellipsis w-full">打ち合わせ予約</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Unanswered Polls Alert */}
          {unansweredPolls.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                未回答の日程調整
                <span className="bg-amber-100 text-amber-700 text-xs py-0.5 px-2 rounded-full">{unansweredPolls.length}件</span>
              </h3>
              <div className="space-y-3">
                {unansweredPolls.map(poll => (
                  <button
                    key={poll.id}
                    onClick={() => setVotingPollId(poll.id)}
                    className="w-full text-left bg-amber-50/50 p-4 rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900 group-hover:text-amber-700 transition-colors">{poll.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">候補: {poll.options.length}件</p>
                    </div>
                    <span className="text-amber-600 text-sm font-medium">回答する →</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Urgent Tasks Alert */}
          {urgentTasks.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                期限が迫っているタスク
                <span className="bg-red-100 text-red-700 text-xs py-0.5 px-2 rounded-full">{urgentTasks.length}件</span>
              </h3>
              <div className="space-y-3">
                {urgentTasks.map(task => {
                  const init = initiatives.find(i => i.id === task.initiativeId);
                  const daysLeft = differenceInDays(parseISO(task.endDate), today);
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="w-full text-left bg-red-50/50 p-4 rounded-xl border border-red-200 hover:bg-red-50 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900 group-hover:text-red-700 transition-colors">{task.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">施策: {init?.title || '不明'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-red-600 mb-0.5">
                          {daysLeft < 0 ? '期限切れ' : daysLeft === 0 ? '今日まで' : `残り${daysLeft}日`}
                        </div>
                        <div className="text-sm font-bold text-red-700">
                          {task.endDate.replace(/-/g, '/')}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Unread Comments Alert */}
          {unreadTasks.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-blue-500" />
                未読コメントがあるタスク
                <span className="bg-blue-100 text-blue-700 text-xs py-0.5 px-2 rounded-full">{unreadTasks.length}件</span>
              </h3>
              <div className="space-y-3">
                {unreadTasks.map(task => {
                  const init = initiatives.find(i => i.id === task.initiativeId);
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="w-full text-left bg-blue-50/50 p-4 rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900 group-hover:text-blue-700 transition-colors flex items-center gap-2">
                          {task.title}
                          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                          <span>施策: {init?.title || '不明'}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {task.endDate.replace(/-/g, '/')}
                          </span>
                        </div>
                      </div>
                      <span className="text-blue-600 text-sm font-medium">確認する →</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* 今週のタスク */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-blue-500" />
                今週のタスク
                <span className="bg-blue-100 text-blue-700 text-xs py-0.5 px-2 rounded-full">
                  {incompletedCount}件未完了
                  {completedCount > 0 && ` / ${completedCount}件完了`}
                </span>
              </h3>
              <div className="flex items-center gap-2">
                {/* Sort toggle */}
                <button
                  onClick={() => setTaskSortOrder(prev => prev === 'deadline' ? 'start' : 'deadline')}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                  title="ソート切替"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {taskSortOrder === 'deadline' ? '期限順' : '開始順'}
                </button>
                {/* Show/hide completed toggle */}
                <button
                  onClick={() => setShowCompletedTasks(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors",
                    showCompletedTasks
                      ? "text-green-700 bg-green-100 hover:bg-green-200"
                      : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                  )}
                >
                  <SortAsc className="w-3.5 h-3.5" />
                  {showCompletedTasks ? '完了含む' : '未完了のみ'}
                </button>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {displayedWeekTasks.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  {weekTasks.length === 0
                    ? '今週開始のタスクはありません。'
                    : '未完了のタスクはありません。'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {displayedWeekTasks.map(task => {
                    const init = initiatives.find(i => i.id === task.initiativeId);
                    const hasUnread = memos.some(m =>
                      m.taskId === task.id &&
                      m.userId !== currentUser.id &&
                      (!task.readStatus?.[currentUser.id] || new Date(m.createdAt) > new Date(task.readStatus[currentUser.id]))
                    );
                    return (
                      <button
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h4 className={cn(
                              "font-medium flex items-center gap-1.5",
                              task.isCompleted ? "line-through text-gray-400" : "text-gray-900"
                            )}>
                              {task.isCompleted && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded font-medium shrink-0">完了</span>
                              )}
                              {task.title}
                              {hasUnread && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                              {task.recurringType && task.recurringType !== 'none' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded font-medium shrink-0">繰返</span>
                              )}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              施策: {init?.title || '不明'}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-medium text-gray-500">期限</div>
                            <div className={cn(
                              "text-sm font-medium",
                              !task.isCompleted && new Date(task.endDate) < new Date() ? "text-red-600" : "text-gray-900"
                            )}>
                              {task.endDate.replace(/-/g, '/')}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* 確定した日程 */}
          {confirmedMeetings.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-green-500" />
                確定した日程
                <span className="bg-green-100 text-green-700 text-xs py-0.5 px-2 rounded-full">{confirmedMeetings.length}件</span>
              </h3>
              <div className="space-y-3">
                {confirmedMeetings.map(({ poll, dateStr, startTime, endTime }) => (
                  <button
                    key={poll.id}
                    onClick={() => setCurrentScreen('meeting')}
                    className="w-full text-left bg-green-50/50 p-4 rounded-xl border border-green-200 hover:bg-green-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="min-w-0">
                      <h4 className="font-medium text-gray-900 group-hover:text-green-700 transition-colors line-clamp-1">{poll.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{dateStr} {startTime}〜{endTime}</p>
                    </div>
                    <span className="text-green-600 text-sm font-medium shrink-0 ml-3">確定済み</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* My Initiatives */}
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <LayoutDashboard className="w-5 h-5 text-green-500" />
              関わっている施策
              <span className="bg-green-100 text-green-700 text-xs py-0.5 px-2 rounded-full">{myInitiatives.length}件</span>
            </h3>
            <div className="space-y-3">
              {myInitiatives.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center text-gray-500 text-sm">
                  現在関わっている施策はありません。
                </div>
              ) : (
                myInitiatives.map(init => {
                  const initTasks = tasks.filter(t => t.initiativeId === init.id);
                  const completedTasks = initTasks.filter(t => t.isCompleted).length;
                  const progress = initTasks.length === 0 ? 0 : Math.round((completedTasks / initTasks.length) * 100);

                  return (
                    <button
                      key={init.id}
                      onClick={() => setCurrentScreen('dashboard')}
                      className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{init.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">
                          {categories.find(c => c.id === init.categoryId)?.name}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{completedTasks}/{initTasks.length} タスク</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* 日程調整 投票モーダル */}
      {votingPollId && (() => {
        const poll = meetingPolls.find(p => p.id === votingPollId);
        if (!poll) return null;
        const myVotes = poll.votes[currentUser.id] || {};
        const voteOptions: { value: VoteStatus; label: string; active: string; inactive: string }[] = [
          { value: 'ok',   label: '○', active: 'bg-green-500 text-white border-green-500',  inactive: 'bg-white border-gray-300 text-gray-400 hover:border-green-400' },
          { value: 'fair', label: '△', active: 'bg-yellow-400 text-white border-yellow-400', inactive: 'bg-white border-gray-300 text-gray-400 hover:border-yellow-400' },
          { value: 'ng',   label: '×', active: 'bg-red-400 text-white border-red-400',       inactive: 'bg-white border-gray-300 text-gray-400 hover:border-red-400' },
        ];
        const answeredCount = Object.keys(myVotes).length;
        const totalCount = poll.options.length;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setVotingPollId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* ヘッダー */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50 rounded-t-2xl shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{poll.title}</h2>
                  <p className="text-xs text-amber-600 mt-0.5">
                    {answeredCount}/{totalCount} 件回答済み
                  </p>
                </div>
                <button onClick={() => setVotingPollId(null)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 候補一覧 */}
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
                {poll.options.map(opt => {
                  const parsed = parseOptionStr(opt);
                  const currentVote = myVotes[opt] || 'none';
                  return (
                    <div key={opt} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="min-w-0">
                        {parsed ? (
                          <>
                            <div className="text-sm font-medium text-gray-800">{parsed.dateStr}</div>
                            <div className="text-xs text-gray-500">{parsed.startTime}〜{parsed.endTime}</div>
                          </>
                        ) : (
                          <div className="text-sm text-gray-700">{opt}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {voteOptions.map(v => (
                          <button
                            key={v.value}
                            onClick={() => voteMeetingPoll(poll.id, opt, v.value)}
                            className={cn(
                              'w-8 h-8 rounded-full text-sm font-bold border-2 transition-colors',
                              currentVote === v.value ? v.active : v.inactive
                            )}
                          >
                            {v.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* フッター */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl shrink-0 flex justify-end">
                <button
                  onClick={() => setVotingPollId(null)}
                  className="px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                >
                  完了
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
