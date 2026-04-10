import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { Plus, Users, Calendar, Check, X, Minus, ChevronRight, ArrowLeft } from 'lucide-react';
import { cn } from '../lib/utils';
import { MeetingPoll, VoteStatus } from '../types';
import { format, parseISO } from 'date-fns';

interface DateTimeOption {
  date: string;
  startTime: string;
  endTime: string;
}

export const TeamMeeting = () => {
  const { currentUser, users, meetingPolls, addMeetingPoll, voteMeetingPoll, moveToTrashMeetingPoll } = useAppContext();
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedPollId, setSelectedPollId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dateTimeOptions, setDateTimeOptions] = useState<DateTimeOption[]>([{ date: '', startTime: '10:00', endTime: '11:00' }]);

  if (!currentUser) return null;

  const activePolls = meetingPolls.filter(p => !p.isDeleted);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = dateTimeOptions
      .filter(o => o.date && o.startTime && o.endTime)
      .map(o => `${format(parseISO(o.date), 'yyyy/MM/dd')} ${o.startTime}-${o.endTime}`);
      
    if (title.trim() && validOptions.length > 0 && selectedUsers.length > 0) {
      addMeetingPoll(title, description, selectedUsers, validOptions);
      setView('list');
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedUsers([]);
      setDateTimeOptions([{ date: '', startTime: '10:00', endTime: '11:00' }]);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const updateOption = (index: number, field: keyof DateTimeOption, value: string) => {
    const newOptions = [...dateTimeOptions];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setDateTimeOptions(newOptions);
  };

  const addOption = () => setDateTimeOptions([...dateTimeOptions, { date: '', startTime: '10:00', endTime: '11:00' }]);
  const removeOption = (index: number) => {
    if (dateTimeOptions.length > 1) {
      setDateTimeOptions(dateTimeOptions.filter((_, i) => i !== index));
    }
  };

  const renderList = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">日程調整</h2>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          新規作成
        </button>
      </div>

      <div className="grid gap-4">
        {activePolls.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            日程調整の予定はありません。
          </div>
        ) : (
          activePolls.map(poll => {
            const creator = users.find(u => u.id === poll.createdBy);
            const myVoteCount = Object.keys(poll.votes[currentUser.id] || {}).length;
            const isFullyVoted = myVoteCount === poll.options.length;

            return (
              <div 
                key={poll.id} 
                onClick={() => {
                  setSelectedPollId(poll.id);
                  setView('detail');
                }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex items-center justify-between"
              >
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{poll.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      対象: {poll.targetUserIds.length}名
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      候補: {poll.options.length}件
                    </span>
                    <span>作成者: {creator?.name || '不明'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {poll.targetUserIds.includes(currentUser.id) && (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      isFullyVoted ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {isFullyVoted ? '回答済み' : '未回答あり'}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="space-y-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setView('list')}
          className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-gray-900">新規日程調整</h2>
      </div>

      <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">要件（タイトル） <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例: キックオフミーティング"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">詳細・メモ</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
              placeholder="アジェンダや場所など"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">調整するメンバー <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {users.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => toggleUserSelection(user.id)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium border text-left flex items-center justify-between transition-colors",
                  selectedUsers.includes(user.id) 
                    ? "bg-blue-50 border-blue-200 text-blue-700" 
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
              >
                {user.name}
                {selectedUsers.includes(user.id) && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">候補日時 <span className="text-red-500">*</span></label>
          <div className="space-y-3">
            {dateTimeOptions.map((option, index) => (
              <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-gray-50 p-3 sm:p-0 sm:bg-transparent rounded-md border sm:border-none border-gray-200">
                <input
                  type="date"
                  required
                  value={option.date}
                  onChange={(e) => updateOption(index, 'date', e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="time"
                    required
                    value={option.startTime}
                    onChange={(e) => updateOption(index, 'startTime', e.target.value)}
                    className="flex-1 sm:flex-none sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-gray-500">-</span>
                  <input
                    type="time"
                    required
                    value={option.endTime}
                    onChange={(e) => updateOption(index, 'endTime', e.target.value)}
                    className="flex-1 sm:flex-none sm:w-auto px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={dateTimeOptions.length === 1}
                    className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 mt-2"
            >
              <Plus className="w-4 h-4" />
              候補を追加
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button
            type="submit"
            disabled={!title.trim() || selectedUsers.length === 0 || dateTimeOptions.filter(o => o.date && o.startTime && o.endTime).length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            作成する
          </button>
        </div>
      </form>
    </div>
  );

  const renderDetail = () => {
    const poll = meetingPolls.find(p => p.id === selectedPollId);
    if (!poll) return null;

    const targetUsers = users.filter(u => poll.targetUserIds.includes(u.id));
    
    // Calculate scores to find best options
    const optionScores = poll.options.map(option => {
      let score = 0;
      let okCount = 0;
      let ngCount = 0;
      targetUsers.forEach(user => {
        const status = poll.votes[user.id]?.[option];
        if (status === 'ok') { score += 2; okCount++; }
        if (status === 'fair') { score += 1; }
        if (status === 'ng') { ngCount++; }
      });
      return { option, score, okCount, ngCount };
    });

    const maxScore = Math.max(...optionScores.map(o => o.score));
    const bestOptions = optionScores.filter(o => o.score === maxScore && o.score > 0 && o.ngCount === 0).map(o => o.option);

    const getVoteIcon = (status?: VoteStatus) => {
      switch (status) {
        case 'ok': return <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto font-bold">○</div>;
        case 'fair': return <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto font-bold">△</div>;
        case 'ng': return <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto font-bold">×</div>;
        default: return <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-200 text-gray-300 flex items-center justify-center mx-auto">-</div>;
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('list')}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{poll.title}</h2>
              <div className="text-sm text-gray-500 mt-1">作成日: {format(parseISO(poll.createdAt), 'yyyy/MM/dd HH:mm')}</div>
            </div>
          </div>
          {poll.createdBy === currentUser.id && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
            >
              削除する
            </button>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-w-md">
            <p className="text-sm text-red-800 mb-3">この日程調整をゴミ箱に移動しますか？</p>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  moveToTrashMeetingPoll(poll.id);
                  setView('list');
                  setShowDeleteConfirm(false);
                }} 
                className="px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
              >
                削除する
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="px-3 py-1.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {poll.description && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 text-sm text-gray-700 whitespace-pre-wrap">
            {poll.description}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 min-w-[200px]">候補日時</th>
                  {targetUsers.map(user => (
                    <th key={user.id} className="px-4 py-3 text-center min-w-[100px]">
                      {user.name}
                      {user.id === currentUser.id && <span className="ml-1 text-xs text-blue-600">(あなた)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {poll.options.map((option) => {
                  const isBest = bestOptions.includes(option);
                  return (
                    <tr key={option} className={cn("hover:bg-gray-50 transition-colors", isBest && "bg-blue-50/50")}>
                      <td className="px-4 py-4 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {option}
                          {isBest && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">最適</span>}
                        </div>
                      </td>
                      {targetUsers.map(user => {
                        const isMe = user.id === currentUser.id;
                        const currentVote = poll.votes[user.id]?.[option];
                        
                        if (isMe) {
                          return (
                            <td key={user.id} className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => voteMeetingPoll(poll.id, option, 'ok')} className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors", currentVote === 'ok' ? "bg-green-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600")}>○</button>
                                <button onClick={() => voteMeetingPoll(poll.id, option, 'fair')} className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors", currentVote === 'fair' ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-amber-100 hover:text-amber-600")}>△</button>
                                <button onClick={() => voteMeetingPoll(poll.id, option, 'ng')} className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors", currentVote === 'ng' ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600")}>×</button>
                              </div>
                            </td>
                          );
                        }
                        
                        return (
                          <td key={user.id} className="px-4 py-3 text-center">
                            {getVoteIcon(currentVote)}
                          </td>
                        );
                      })}
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

  return (
    <div className="h-full">
      {view === 'list' && renderList()}
      {view === 'create' && renderCreate()}
      {view === 'detail' && renderDetail()}
    </div>
  );
};
