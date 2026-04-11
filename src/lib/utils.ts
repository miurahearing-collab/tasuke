import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// テキスト内のURLを検出してクリッカブルなリンクに変換する
const URL_REGEX = /(https?:\/\/[^\s\u3000\u3001\u3002\uff01\uff0c\uff0e\u300c\u300d]+)/g;

export function renderTextWithLinks(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0; // reset stateful regex
      return React.createElement(
        'a',
        {
          key: i,
          href: part,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'text-blue-600 underline hover:text-blue-800 break-all',
          onClick: (e: React.MouseEvent) => e.stopPropagation(),
        },
        part
      );
    }
    URL_REGEX.lastIndex = 0;
    return part;
  });
}
