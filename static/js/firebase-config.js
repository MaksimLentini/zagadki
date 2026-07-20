// ===== FIREBASE INIT =====
// Конфиг загружается безопасно с бэкенда через API
// Это защищает API-ключ от утечки в исходном коде репозитория

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc, getDoc, setDoc, updateDoc, increment,
    collection, addDoc, query, where, orderBy,
    onSnapshot, getDocs, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Загружаем конфиг с бэкенда
async function initFirebase() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Ошибка загрузки конфига Firebase');
        }
        const firebaseConfig = await response.json();
        
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // Делаем доступным для app.js через window
        window.fb = {
            auth, db,
            createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
            doc, getDoc, setDoc, updateDoc, increment,
            collection, addDoc, query, where, orderBy, onSnapshot, getDocs, serverTimestamp, limit
        };

        // Сигнализируем app.js, что Firebase готов
        window.dispatchEvent(new Event('firebase-ready'));
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        // Показываем ошибку пользователю
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0c0b14; color: #e9e7f5; font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center;">
                <div style="max-width: 400px;">
                    <h1 style="font-size: 32px; margin-bottom: 16px;">⚠️ Ошибка инициализации</h1>
                    <p>Не удалось подключиться к базе данных. Пожалуйста, обновите страницу или обратитесь в поддержку.</p>
                    <p style="font-size: 12px; color: #9694b8; margin-top: 16px;">Детали: ${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Инициализируем Firebase при загрузке
initFirebase();
