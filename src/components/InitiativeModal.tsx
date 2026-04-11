import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { X } from 'lucide-react';

export const InitiativeModal = ({ onClose }: { onClose: () => void }) => {
  const { currentUser, categories, users, addInitiative } = useAppContext();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [categoryError, setCategoryError] = useState(false);

  // Filter categories based on role
  const availableCategories = categories.filter(c => currentUser?.role === 'admin' || !c.isAdminOnly);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      setCategoryError(true);
      return;
    }
    if (title.trim() && categoryId) {
      addInitiative(title.trim(), categoryId, assigneeIds);
      onClose();
    }
  };

  const toggleAssignee = (userId: string) => {
    setAssigneeIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">新規施策の作成</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              施策名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="例：春のキャンペーン施策"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カテゴリー <span className="text-red-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setCategoryError(false);
              }}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                categoryError ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            >
              <option value="">選択してください</option>
              {availableCategories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {categoryError && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                カテゴリーを選択してください。カテゴリーが未設定の場合、施策一覧に表示されません。
              </p>
            )}
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

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              作成
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
