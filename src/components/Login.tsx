import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'tasuke_saved_credentials';

export const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        setEmail(savedEmail || '');
        setPassword(savedPassword || '');
        setRememberMe(true);
      } catch {
        // ignore
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        if (rememberMe) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const role = email === 'miura.hearing@gmail.com' ? 'admin' : 'member';
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email,
          name,
          role,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '認証エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="text-center mb-8">
          {/* tasuke logo */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="44" height="44" rx="12" fill="#006239"/>
              <rect x="8" y="12" width="28" height="22" rx="3" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="2"/>
              <rect x="8" y="17" width="28" height="2" fill="white"/>
              <line x1="14" y1="12" x2="14" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="30" y1="12" x2="30" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <polyline points="15,26 19,30 29,21" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <span className="text-3xl font-black text-[#006239] tracking-tight">tasuke</span>
          </div>
          <p className="text-gray-500 text-sm">{isLogin ? 'ログインしてください' : 'アカウントを作成してください'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#006239]"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#006239]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#006239]"
            />
          </div>

          {isLogin && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#006239] focus:ring-[#006239] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 cursor-pointer select-none">
                ログイン情報を保存する
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 font-medium rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#006239' }}
            onMouseOver={e => (e.currentTarget.style.backgroundColor = '#004d2b')}
            onMouseOut={e => (e.currentTarget.style.backgroundColor = '#006239')}
          >
            {loading ? '処理中...' : (isLogin ? 'ログイン' : '登録')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm hover:underline"
            style={{ color: '#006239' }}
          >
            {isLogin ? 'アカウントを作成する' : 'ログイン画面に戻る'}
          </button>
        </div>
      </div>
    </div>
  );
};
