import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Cấu hình Firebase của bạn
const firebaseConfig = {
  apiKey: "AIzaSyAXVfwBlBRIXJATyZuA7LBW7ADE1YkGzio",
  authDomain: "giaoanthongminh.firebaseapp.com",
  projectId: "giaoanthongminh",
  storageBucket: "giaoanthongminh.firebasestorage.app",
  messagingSenderId: "999463177114",
  appId: "1:999463177114:web:a01a4bcc4a3fcf40c94823",
  measurementId: "G-P9KFTNCMCY"
};

// Khởi tạo Firebase (Kiểm tra xem app đã chạy chưa để tránh lỗi render của Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Xuất các công cụ để dùng ở file khác
export const auth = getAuth(app);
export const db = getFirestore(app);
