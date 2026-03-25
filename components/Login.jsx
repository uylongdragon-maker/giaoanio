'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Sparkles, Mail, Lock, LogIn, UserPlus, Chrome } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0B0F19] relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-violet-600/20 rounded-full blur-[120px] mix-blend-screen animate-blob animation-delay-2000"></div>

      <div className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[48px] p-8 md:p-10 shadow-2xl glass-effect border-t-white/20">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-3xl flex items-center justify-center rotate-12 shadow-2xl shadow-indigo-500/40">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-black bg-gradient-to-r from-white via-indigo-200 to-slate-400 bg-clip-text text-transparent mb-2 tracking-tight">
            GIAOÁN I.O
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {isRegistering ? 'Tạo tài khoản mới để bắt đầu' : 'Đăng nhập vào bộ não AI của bạn'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs py-3 px-4 rounded-2xl mb-6 text-center font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="email"
              placeholder="Email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pl-14 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              required
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="password"
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pl-14 text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 group disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                {isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                <span>{isRegistering ? 'ĐĂNG KÝ' : 'ĐĂNG NHẬP'}</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 flex items-center gap-4">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hoặc</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full mt-8 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 group"
        >
          <Chrome className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span>Tiếp tục với Google</span>
        </button>

        <p className="mt-10 text-center text-xs font-bold text-slate-500">
          {isRegistering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="ml-2 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isRegistering ? 'Đăng nhập ngay' : 'Đăng ký miễn phí'}
          </button>
        </p>
      </div>
    </div>
  );
}
