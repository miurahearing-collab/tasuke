import React, { useState, useEffect } from 'react';
import { useAppContext } from '../store/AppContext';
import { Plus, Trash2, Edit2, Check, Shield, User as UserIcon, Save, Bell, Users } from 'lucide-react';
import { Role, User, NotificationSettings } from '../types';
import { auth } from '../firebase';
import { updatePassword } from 'firebase/auth';

const DAY_NAMES = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export const Settings = () => {
  const {
    currentUser,
    categories, addCategory, updateCategory, deleteCategory,
    users, updateUser,
    appSettings, updateAppSettings,
    notificationSettings, updateNotificationSettings, requestNotificationPermission,
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

  // Notification State
  const [localNotif, setLocalNotif] = useState<NotificationSettings>(notificationSettings);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [notifMsg, setNotifMsg] = useState('');

  useEffect(() => {
    setLocalNotif(notificationSettings);
  }, [notificationSettings]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    } else {
      setNotifPermission('unsupported');
    }
  }, []);

  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    if (result) setNotifPermission(result);
  };

  const handleSaveNotificationSettings = async () => {
    if ((localNotif.weeklyEnabled || localNotif.dailyEnabled) &&
        'Notification' in window && Notification.permission === 'default') {
      const perm = await requestNotificationPermission();
      if (perm) setNotifPermission(perm);
    }
    await updateNotificationSettings(localNotif);
    setNotifMsg('通知設定を保存しました。');
    setTimeout(() => setNotifMsg(''), 3000);
  };

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

      {/* Notification Settings (All users) */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-500" />
            通知設定
          </h3>
        </div>
        <div className="p-6 space-y-6">
          {notifMsg && (
            <div className="p-3 bg-green-50 text-green-700 text-sm rounded-md">{notifMsg}</div>
          )}

          {/* ブラウザ通知の許可状態 */}
          {notifPermission === 'unsupported' && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
              このブラウザはデスクトップ通知に対応していません。
            </div>
          )}
          {notifPermission === 'denied' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              ブラウザの通知が拒否されています。ブラウザの設定から通知を許可してください。
            </div>
          )}
          {notifPermission === 'default' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-center justify-between gap-3">
              <span className="text-sm text-yellow-800">
                通知を受け取るにはブラウザの通知許可が必要です。
              </span>
              <button
                onClick={handleRequestPermission}
                className="shrink-0 px-3 py-1.5 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-md hover:bg-yellow-200"
              >
                通知を許可する
              </button>
            </div>
          )}

          {/* 週次通知 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={localNotif.weeklyEnabled}
                onChange={(e) => setLocalNotif(s => ({ ...s, weeklyEnabled: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-900">週次通知（今週のタスク数）</span>
            </label>
            {localNotif.weeklyEnabled && (
              <div className="ml-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">曜日</label>
                  <select
                    value={localNotif.weeklyDayOfWeek}
                    onChange={(e) => setLocalNotif(s => ({ ...s, weeklyDayOfWeek: Number(e.target.value) }))}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {DAY_NAMES.map((d, i) => (
                      <option key={i} value={i}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">時刻</label>
                  <select
                    value={localNotif.weeklyHour}
                    onChange={(e) => setLocalNotif(s => ({ ...s, weeklyHour: Number(e.target.value) }))}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">時</span>
                  <select
                    value={localNotif.weeklyMinute}
                    onChange={(e) => setLocalNotif(s => ({ ...s, weeklyMinute: Number(e.target.value) }))}
                    className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {MINUTES.map(m => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-600">分</span>
                </div>
              </div>
            )}
          </div>

          {/* 毎日通知 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={localNotif.dailyEnabled}
                onChange={(e) => setLocalNotif(s => ({ ...s, dailyEnabled: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-900">毎日通知（期限3日以内のタスク一覧）</span>
            </label>
            {localNotif.dailyEnabled && (
              <div className="ml-6 flex items-center gap-2">
                <label className="text-sm text-gray-600">時刻</label>
                <select
                  value={localNotif.dailyHour}
                  onChange={(e) => setLocalNotif(s => ({ ...s, dailyHour: Number(e.target.value) }))}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-600">時</span>
                <select
                  value={localNotif.dailyMinute}
                  onChange={(e) => setLocalNotif(s => ({ ...s, dailyMinute: Number(e.target.value) }))}
                  className="px-2 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {MINUTES.map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-600">分</span>
              </div>
            )}
          </div>

          <button
            onClick={handleSaveNotificationSettings}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存する
          </button>
        </div>
      </section>

      {currentUser.role === 'admin' && (
        <>
          {/* アクセス権限設定 */}
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                アクセス権限設定
              </h3>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">メンバー分析の閲覧を許可するユーザー</p>
                <p className="text-xs text-gray-500 mb-3">
                  管理者は常に閲覧可能です。以下から一般ユーザーを個別に選択できます。
                </p>
                <div className="space-y-2">
                  {users.filter(u => u.role !== 'admin').map(u => {
                    const allowedIds = appSettings.memberAnalysisAllowedUserIds ?? [];
                    const allowed = allowedIds.includes(u.id);
                    return (
                      <label key={u.id} className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowed}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...allowedIds, u.id]
                              : allowedIds.filter(id => id !== u.id);
                            updateAppSettings({ memberAnalysisAllowedUserIds: next });
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500 w-4 h-4 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900">{u.name}</span>
                          {u.email && <span className="ml-2 text-xs text-gray-400">{u.email}</span>}
                        </div>
                        {allowed && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium shrink-0">閲覧可</span>
                        )}
                      </label>
                    );
                  })}
                  {users.filter(u => u.role !== 'admin').length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">一般ユーザーがいません</p>
                  )}
                </div>
              </div>
            </div>
          </section>

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
