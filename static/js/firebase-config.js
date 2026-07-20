// ===== FIREBASE INIT =====
// Конфиг взят из твоего Firebase-проекта "zadaka".
// Аналитика (getAnalytics) в чате не нужна и требует https-хостинг,
// поэтому она не подключена — при желании добавь её отдельно.

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
    doc, getDoc, setDoc, updateDoc,
    collection, addDoc, query, where, orderBy,
    onSnapshot, serverTimestamp, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyClloQaQp2tJ-fgnqdADv42xKIfaZ2DwEQ",
    authDomain: "zadaka.firebaseapp.com",
    projectId: "zadaka",
    storageBucket: "zadaka.firebasestorage.app",
    messagingSenderId: "780777564213",
    appId: "1:780777564213:web:439785a8262b6eaf96297c",
    measurementId: "G-1YT9M46B5D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Делаем доступным для app.js через window, чтобы не тащить сборщик модулей
window.fb = {
    auth, db,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
    doc, getDoc, setDoc, updateDoc,
    collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit
};

// Сигнализируем app.js, что Firebase готов
window.dispatchEvent(new Event('firebase-ready'));
