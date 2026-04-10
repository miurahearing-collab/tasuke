import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { Plus, Trash2, Edit2, Check, Shield, User as UserIcon, Save } from 'lucide-react';
import { Role, User } from '../types';
import { auth } from '../firebase';
import { updatePassword } from 'firebase/auth';

export const Settings = () => {
  const { 
    currentUser, 
    categories, addCategory, updateCategory, deleteCategory,
    users, updateUser 
  } = useAppContext();

  // Profile State
  const [profileName, setProfileName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
    }
  }, [currentUser]);

  // Category State
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIsAdminOnly, setEditCatIsAdminOnly] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIsAdminOnly, setNewCatIsAdminOnly] = useState(false);

  // User Management State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<Role>('member');
  const [editUserVisibleCategoryIds, setEditUserVisibleCategoryIds] = useState<string[]>([]);

  if (!currentUser) return null;

  const handleProfileUpdate = async () => {
    setProfileMsg('');
    setProfileErr('');
    try {
      if (profileName.trim() !== currentUser.name) {
        await updateUser(currentUser.id, profileName.trim(), currentUser.role, currentUser.visibleCategoryIds);
      }
      if (newPassword) {
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
          setNewPassword('');
        }
      }
      setProfileMsg('プロフィールを更新しました。');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        setProfileErr('パスワードを変更するには、一度ログアウトして再度ログインしてください。');
      } else {
        setProfileErr('更新に失敗しました: ' + (error.message || ''));
      }
    }
  };

  // Category Handlers
  const handleAddCategory = () => {
    if (newCatName.trim()) {
      addCategory(newCatName.trim(), newCatIsAdminOnly);
      setNewCatName('');
      setNewCatIsAdminOnly(false);
    }
  };

  const startEditCategory = (cat: any) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatIsAdminOnly(cat.isAdminOnly);
  };

  const saveEditCategory = () => {
    if (editingCatId && editCatName.trim()) {
      updateCategory(editingCatId, editCatName.trim(), editCatIsAdminOnly);
      setEditingCatId(null);
    }
  };

  // User Handlers
  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditUserName(user.name);
    setEditUserRole(user.role);
    setEditUserVisibleCategoryIds(user.visibleCategoryIds || categories.map(c => c.id));
  };

  const saveEditUser = () => {
    if (editingUserId && editUserName.trim()) {
      updateUser(editingUserId, editUserName.trim(), editUserRole, editUserVisibleCategoryIds);
      setEditingUserId(null);
    }
  };

  const toggleUserCategory = (categoryId: string) => {
    setEditUserVisibleCategoryIds(prev => 
      prev.includes(categoryId) ? prev.filter(id => id !== categoryId) : [...prev, categoryId]
    );
  };

  return (
    <div className="flex flex-col space-y-8 max-w-4xl mx-auto w-full pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">設定</h2>
      </div>

      {/* Profile Section (For all users) */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-gray-500" />
            アカウント設定
          </h3>
        </div>
        <div className="p-6 space-y-4">
          {profileMsg && <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md">{profileMsg}</div>}
          {profileErr && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{profileErr}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ユーザー名</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">新しいパスワード (変更する場合のみ)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="未入力の場合は変更されません"
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <button
            onClick={handleProfileUpdate}
            disabled={!profileName.trim()}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存する
          </button>
        </div>
      </section>

      {currentUser.role === 'admin' && (
        <>
          {/* User Management Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-500" />
                ユーザー管理
              </h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">
                ※新規ユーザーはログイン画面の「アカウントを作成する」から各自で登録を行ってください。管理者はここで名前や権限の変更が可能です。
              </p>
              <div className="space-y-2">
                {users.map(user => (
                  <div key={user.id} className="flex flex-col p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      {editingUserId === user.id ? (
                        <div className="flex-1 flex flex-col gap-3 mr-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={editUserName}
                              onChange={(e) => setEditUserName(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <select
                              value={editUserRole}
                              onChange={(e) => setEditUserRole(e.target.value as Role)}
                              disabled={user.id === currentUser.id}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                            >
                              <option value="member">一般ユーザー</option>
                              <option value="admin">管理者</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">表示可能なカテゴリー</label>
                            <div className="flex flex-wrap gap-2">
                              {categories.map(cat => (
                                <label key={cat.id} className="flex items-center gap-1 text-xs text-gray-600">
                                  <input
                                    type="checkbox"
                                    checked={editUserVisibleCategoryIds.includes(cat.id)}
                                    onChange={() => toggleUserCategory(cat.id)}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  {cat.name}
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="font-medium text-sm text-gray-900">
                            {user.name}
                            <span className="ml-2 text-xs text-gray-500 font-normal">{user.email}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {user.role === 'admin' ? (
                              <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                管理者
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
                                一般ユーザー
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      <div className="flex items-center gap-1 ml-4">
                        {editingUserId === user.id ? (
                          <button onClick={saveEditUser} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                            <Check className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => startEditUser(user)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Category Management Section */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-500" />
                カテゴリー管理
              </h3>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">新規カテゴリー追加</h4>
                <div className="flex gap-3 items-start">
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="カテゴリー名"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={newCatIsAdminOnly}
                        onChange={(e) => setNewCatIsAdminOnly(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      管理者専用にする
                    </label>
                  </div>
                  <button
                    onClick={handleAddCategory}
                    disabled={!newCatName.trim()}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    追加
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    {editingCatId === cat.id ? (
                      <div className="flex-1 flex items-center gap-3 mr-3">
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <label className="flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={editCatIsAdminOnly}
                            onChange={(e) => setEditCatIsAdminOnly(e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          管理者用
                        </label>
                      </div>
                    ) : (
                      <div className="flex-1">
                        <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                          {cat.name}
                          {cat.isAdminOnly && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">管理者</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {editingCatId === cat.id ? (
                        <button onClick={saveEditCategory} className="p-1.5 text-green-600 hover:bg-green-50 rounded">
                          <Check className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => startEditCategory(cat)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
