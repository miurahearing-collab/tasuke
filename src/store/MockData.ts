import { addDays, format } from 'date-fns';
import { Category, Initiative, Task, TaskMemo, User } from '../types';

const today = new Date();

export const mockUsers: User[] = [
  { id: 'u1', name: '管理者ユーザー', role: 'admin' },
  { id: 'u2', name: '一般ユーザー', role: 'member' },
];

export const mockCategories: Category[] = [
  { id: 'c1', name: 'マーケ', isAdminOnly: false },
  { id: 'c2', name: 'CS', isAdminOnly: false },
  { id: 'c3', name: 'その他', isAdminOnly: false },
  { id: 'c4', name: '管理者', isAdminOnly: true },
];

export const mockInitiatives: Initiative[] = [
  { id: 'i1', title: '春のキャンペーン施策', categoryId: 'c1', isArchived: false, createdAt: new Date().toISOString() },
  { id: 'i2', title: '顧客サポート改善', categoryId: 'c2', isArchived: false, createdAt: new Date().toISOString() },
  { id: 'i3', title: '社内システム移行', categoryId: 'c4', isArchived: false, createdAt: new Date().toISOString() },
  { id: 'i4', title: '過去のイベント', categoryId: 'c1', isArchived: true, createdAt: new Date().toISOString() },
];

export const mockTasks: Task[] = [
  { id: 't1', initiativeId: 'i1', title: 'LP作成', description: '春のキャンペーン用ランディングページの作成。', startDate: format(addDays(today, -2), 'yyyy-MM-dd'), endDate: format(addDays(today, 3), 'yyyy-MM-dd'), isCompleted: false },
  { id: 't2', initiativeId: 'i1', title: '広告配信設定', description: 'Google広告、Meta広告の入稿と配信設定。', startDate: format(addDays(today, 1), 'yyyy-MM-dd'), endDate: format(addDays(today, 7), 'yyyy-MM-dd'), isCompleted: false },
  { id: 't3', initiativeId: 'i2', title: 'マニュアル改訂', description: 'CSチーム向け対応マニュアルのアップデート。', startDate: format(addDays(today, -5), 'yyyy-MM-dd'), endDate: format(addDays(today, -1), 'yyyy-MM-dd'), isCompleted: true },
  { id: 't4', initiativeId: 'i3', title: 'サーバー構築', description: '新システム用のAWS環境構築。', startDate: format(addDays(today, 0), 'yyyy-MM-dd'), endDate: format(addDays(today, 14), 'yyyy-MM-dd'), isCompleted: false },
];

export const mockMemos: TaskMemo[] = [
  { id: 'm1', taskId: 't1', userId: 'u1', content: 'デザイン案は明日のMTGで確認しましょう。', createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'm2', taskId: 't1', userId: 'u2', content: '承知いたしました。デザインチームに共有済みです。', createdAt: new Date(Date.now() - 43200000).toISOString() },
];
