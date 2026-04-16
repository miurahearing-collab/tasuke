import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { X } from 'lucide-react';
import { format, addDays, addMonths, parseISO, differenceInDays } from 'date-fns';
import { RecurrenceType } from '../types';

export const TaskModal = ({ initiativeId, onClose }: { initiativeId: string, onClose: () => void }) => {
  const { addTask, users } = useAppContext();
  const [title, setTitle] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recurrence state
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(format(addMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [selectedDatesOfMonth, setSelectedDatesOfMonth] = useState<number[]>([]);
  const [selectedWeekOfMonth, setSelectedWeekOfMonth] = useState<number>(1);
  const [selectedDayOfWeekMonthly, setSelectedDayOfWeekMonthly] = useState<number>(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const duration = differenceInDays(parseISO(endDate), parseISO(startDate));

      if (recurrenceType === 'none') {
        await addTask(initiativeId, title.trim(), startDate, endDate, assigneeIds);
      } else {
        // Single task with recurrence metadata
        await addTask(initiativeId, title.trim(), startDate, endDate, assigneeIds, {
          recurringType: recurrenceType,
          recurringEndDate: recurrenceEndDate,
          recurringDuration: duration,
          recurringDaysOfWeek: recurrenceType === 'weekly' ? selectedDaysOfWeek : undefined,
          recurringDatesOfMonth: recurrenceType === 'monthly_date' ? selectedDatesOfMonth : undefined,
          recurringWeekOfMonth: recurrenceType === 'monthly_week' ? selectedWeekOfMonth : undefined,
          recurringDayOfWeekMonthly: recurrenceType === 'monthly_week' ? selectedDayOfWeekMonthly : undefined,
        });
      }
      onClose();
    } catch (error) {
      console.error('Error adding task:', error);
      alert('タスクの追加に失敗しました。');
      setIsSubmitting(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleDayOfWeek = (day: number) => {
    setSelectedDaysOfWeek(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleDateOfMonth = (date: number) => {
    setSelectedDatesOfMonth(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const daysOfWeek = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">新規タスクの追加</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タスク名</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">担当者（複数選択可）</label>
              <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  min={startDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Recurrence Settings */}
            <div className="pt-2 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">繰り返し設定</label>
              <select
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
              >
                <option value="none">繰り返しなし</option>
                <option value="weekly">毎週</option>
                <option value="monthly_date">毎月（日付指定）</option>
                <option value="monthly_week">毎月（第〇週・曜日指定）</option>
              </select>

              {recurrenceType !== 'none' && (
                <div className="space-y-3 bg-blue-50 p-3 rounded-md border border-blue-100">
                  <p className="text-xs text-blue-700 font-medium">
                    ※ 繰り返しタスクは1つのタスクとして管理されます。期間が終わると自動的に未完了に戻ります。
                  </p>

                  {recurrenceType === 'weekly' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">繰り返す曜日を選択</label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map((day, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => toggleDayOfWeek(index)}
                            className={`w-8 h-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors ${
                              selectedDaysOfWeek.includes(index)
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recurrenceType === 'monthly_date' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">繰り返す日付を選択</label>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(date => (
                          <button
                            key={date}
                            type="button"
                            onClick={() => toggleDateOfMonth(date)}
                            className={`w-8 h-8 rounded text-xs font-medium flex items-center justify-center transition-colors ${
                              selectedDatesOfMonth.includes(date)
                                ? 'bg-blue-600 text-white'
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {date}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {recurrenceType === 'monthly_week' && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">週を選択</label>
                        <select
                          value={selectedWeekOfMonth}
                          onChange={(e) => setSelectedWeekOfMonth(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value={1}>第1週</option>
                          <option value={2}>第2週</option>
                          <option value={3}>第3週</option>
                          <option value={4}>第4週</option>
                          <option value={5}>最終週</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">曜日を選択</label>
                        <select
                          value={selectedDayOfWeekMonthly}
                          onChange={(e) => setSelectedDayOfWeekMonthly(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {daysOfWeek.map((day, index) => (
                            <option key={index} value={index}>{day}曜日</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">繰り返し終了日</label>
                    <input
                      type="date"
                      value={recurrenceEndDate}
                      onChange={(e) => setRecurrenceEndDate(e.target.value)}
                      min={startDate}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !startDate || !endDate || isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? '追加中...' : '追加'}
          </button>
        </div>
        </form>
      </div>
    </div>
  );
};
