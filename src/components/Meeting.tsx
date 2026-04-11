import React, { useEffect } from 'react';

declare global {
  interface Window {
    TimerexCalendar?: () => void;
  }
}

export const Meeting = () => {
  useEffect(() => {
    // スクリプトが既に存在するかチェック（二重読み込み防止）
    let script = document.getElementById('timerex_embed') as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = 'timerex_embed';
      script.src = 'https://asset.timerex.net/js/embed.js';
      script.async = true;

      script.onload = () => {
        if (window.TimerexCalendar) {
          window.TimerexCalendar();
        }
      };

      document.body.appendChild(script);
    } else {
      // 既に読み込み済みの場合は直接実行（再マウント時のウィジェット再初期化）
      if (window.TimerexCalendar) {
        window.TimerexCalendar();
      }
    }

    // アンマウント時にウィジェットの内容をクリア（再マウント時の二重表示防止）
    return () => {
      const container = document.getElementById('timerex_calendar');
      if (container) container.innerHTML = '';
    };
  }, []);

  return (
    <div className="flex flex-col space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">打ち合わせ予約（三浦）</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4 sm:p-6 min-h-[800px]">
        {/* TimeRex Widget Container */}
        <div id="timerex_calendar" data-url="https://timerex.net/s/miura.hearing_b774/27bc676a" className="w-full h-full"></div>
      </div>
    </div>
  );
};
