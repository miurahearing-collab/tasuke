import React, { useState } from 'react';
import { useAppContext } from '../store/AppContext';
import { LogOut, LayoutDashboard, Archive, Settings as SettingsIcon, Calendar, Clock, Menu, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  currentScreen: 'home' | 'dashboard' | 'archive' | 'settings' | 'meeting' | 'reservation' | 'evaluation';
  setCurrentScreen: (screen: 'home' | 'dashboard' | 'archive' | 'settings' | 'meeting' | 'reservation' | 'evaluation') => void;
}

export const Layout = ({ children, currentScreen, setCurrentScreen }: LayoutProps) => {
  const { currentUser, logout } = useAppContext();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!currentUser) return null;

  const navigation = [
    { name: 'ホーム', id: 'home', icon: LayoutDashboard, group: 'メイン' },
    { name: 'ダッシュボード', id: 'dashboard', icon: LayoutDashboard, group: 'メイン' },
    { name: 'アーカイブ', id: 'archive', icon: Archive, group: 'メイン' },
    { name: 'スケジューラー', id: 'meeting', icon: Calendar, group: 'ミーティング' },
    { name: '打ち合わせ予約', id: 'reservation', icon: Clock, group: 'ミーティング' },
    ...(currentUser.role === 'admin' ? [
      { name: '評価ダッシュボード', id: 'evaluation', icon: LayoutDashboard, group: 'システム' },
      { name: '設定', id: 'settings', icon: SettingsIcon, group: 'システム' }
    ] : [
      { name: '設定', id: 'settings', icon: SettingsIcon, group: 'システム' }
    ])
  ] as const;

  const handleNavigation = (id: any) => {
    setCurrentScreen(id);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Top Header (Persistent) */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <Menu className="w-6 h-6" />
          </button>
          <button
            onClick={() => setCurrentScreen('home')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="ホームへ戻る"
          >
            <svg width="32" height="32" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="44" height="44" rx="12" fill="#006239"/>
              <rect x="8" y="12" width="28" height="22" rx="3" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="2"/>
              <rect x="8" y="17" width="28" height="2" fill="white"/>
              <line x1="14" y1="12" x2="14" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="30" y1="12" x2="30" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <polyline points="15,26 19,30 29,21" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <span className="text-xl font-black tracking-tight" style={{ color: '#006239' }}>tasuke</span>
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-gray-900">{currentUser.name}</p>
            <p className="text-xs text-gray-500">{currentUser.role === 'admin' ? '管理者' : '一般ユーザー'}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors"
            title="ログアウト"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="h-16 flex items-center px-6 border-b border-gray-200 justify-between lg:hidden shrink-0">
            <span className="font-bold text-gray-900">メニュー</span>
            <button 
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
            {/* Grouped Navigation */}
            {['メイン', 'ミーティング', 'システム'].map(group => (
              <div key={group}>
                <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group}
                </div>
                <div className="space-y-1">
                  {navigation.filter(item => item.group === group).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                        currentScreen === item.id 
                          ? "bg-green-50 text-green-700" 
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <item.icon className={cn(
                        "w-5 h-5 shrink-0",
                        currentScreen === item.id ? "text-green-600" : "text-gray-400"
                      )} />
                      <span className="truncate">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-gray-200 shrink-0 bg-gray-50/50 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{currentUser.name}</p>
                <p className="text-xs text-gray-500 truncate">{currentUser.role === 'admin' ? '管理者' : '一般ユーザー'}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50 relative">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
