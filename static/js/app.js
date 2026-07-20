// ===== ЗАГАДОЧНИК — клиентская логика =====
// Firebase инициализирован в firebase-config.js и лежит в window.fb
// (модульные скрипты выполняются по порядку, так что window.fb уже
// готов к моменту выполнения этого файла).

const {
    auth, db,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
    doc, getDoc, setDoc, updateDoc,
    collection, addDoc, query, where, onSnapshot, serverTimestamp, limit
} = window.fb;

const el = (id) => document.getElementById(id);

const state = {
    user: null,          // { uid, name, email }
    authMode: 'login',   // 'login' | 'register'
    currentChatId: null,
    currentChatMeta: null,
    messagesUnsub: null,
    chatsUnsub: null,
    replyTarget: null,   // { id, senderName, text, isRiddle, solved }
};

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function initials(name) {
    return (name || '?').trim().charAt(0).toUpperCase();
}

// ===================================================================
// АВТОРИЗАЦИЯ
// ===================================================================

function setAuthMode(mode) {
    state.authMode = mode;
    el('authError').style.display = 'none';
    el('authSuccess').style.display = 'none';
    if (mode === 'register') {
        el('regName').style.display = 'block';
        el('authSubtitle').textContent = 'Создайте аккаунт, чтобы начать';
        el('authSubmitBtn').textContent = 'Зарегистрироваться';
        el('switchText').textContent = 'Уже есть аккаунт?';
        el('switchLink').textContent = 'Войти';
    } else {
        el('regName').style.display = 'none';
        el('authSubtitle').textContent = 'Войдите, чтобы начать разгадывать';
        el('authSubmitBtn').textContent = 'Войти';
        el('switchText').textContent = 'Нет аккаунта?';
        el('switchLink').textContent = 'Зарегистрироваться';
    }
}

function authErrorMessage(err) {
    const map = {
        'auth/email-already-in-use': 'Этот email уже зарегистрирован',
        'auth/invalid-email': 'Некорректный email',
        'auth/weak-password': 'Пароль должен быть не менее 6 символов',
        'auth/user-not-found': 'Пользователь не найден',
        'auth/wrong-password': 'Неверный пароль',
        'auth/invalid-credential': 'Неверный email или пароль',
        'auth/too-many-requests': 'Слишком много попыток, попробуйте позже',
    };
    return map[err.code] || 'Что-то пошло не так, попробуйте ещё раз';
}

async function ensureUserDoc(uid, name, email) {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { uid, name, email, createdAt: serverTimestamp() });
    }
    return snap.exists() ? snap.data() : { uid, name, email };
}

async function handleAuthSubmit() {
    const email = el('authEmail').value.trim().toLowerCase();
    const password = el('authPassword').value;
    const name = el('regName').value.trim();
    const errorBox = el('authError');
    const btn = el('authSubmitBtn');

    errorBox.style.display = 'none';

    if (!email || !password) {
        errorBox.textContent = 'Заполните email и пароль';
        errorBox.style.display = 'block';
        return;
    }
    if (state.authMode === 'register' && password.length < 6) {
        errorBox.textContent = 'Пароль должен быть не менее 6 символов';
        errorBox.style.display = 'block';
        return;
    }

    btn.disabled = true;
    try {
        if (state.authMode === 'register') {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            const finalName = name || email.split('@')[0];
            await updateProfile(cred.user, { displayName: finalName });
            await ensureUserDoc(cred.user.uid, finalName, email);
        } else {
            await signInWithEmailAndPassword(auth, email, password);
        }
        // дальше подхватит onAuthStateChanged
    } catch (err) {
        errorBox.textContent = authErrorMessage(err);
        errorBox.style.display = 'block';
    } finally {
        btn.disabled = false;
    }
}

function initAuthUI() {
    setAuthMode('login');
    el('switchLink').addEventListener('click', () => {
        setAuthMode(state.authMode === 'login' ? 'register' : 'login');
    });
    el('authSubmitBtn').addEventListener('click', handleAuthSubmit);
    el('authPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAuthSubmit(); });
    el('logoutBtn').addEventListener('click', async () => {
        if (state.messagesUnsub) state.messagesUnsub();
        if (state.chatsUnsub) state.chatsUnsub();
        await signOut(auth);
    });
}

// ===================================================================
// ЧАТЫ — СПИСОК
// ===================================================================

async function ensureChatDoc(chatId, data) {
    const ref = doc(db, 'chats', chatId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
        await setDoc(ref, { ...data, lastMessage: '', lastMessageAt: serverTimestamp(), createdAt: serverTimestamp() });
    }
    return chatId;
}

function chatItemHtml(id, avatarClass, avatarChar, name, preview) {
    return `
        <button class="chat-item" data-chat-id="${id}">
            <div class="ci-avatar ${avatarClass}">${avatarChar}</div>
            <div class="ci-meta">
                <div class="ci-name">${escapeHtml(name)}</div>
                <div class="ci-preview">${escapeHtml(preview || 'Нет сообщений')}</div>
            </div>
        </button>`;
}

function renderChatsList(dmChats) {
    const uid = state.user.uid;
    const aiId = `ai_${uid}`;

    let html = chatItemHtml(aiId, 'bot', '🤖', 'AI-помощник', 'Личный чат с нейросетью');
    html += chatItemHtml('global', 'global', '🌐', 'Общий чат', 'Все пользователи видят сообщения');

    if (dmChats.length) {
        html += `<div class="chats-label" style="margin-top:8px;"><span>Личные чаты</span></div>`;
        dmChats.forEach((c) => {
            const otherUid = c.participants.find((p) => p !== uid);
            const otherName = (c.names && c.names[otherUid]) || 'Пользователь';
            html += chatItemHtml(c.id, '', initials(otherName), otherName, c.lastMessage);
        });
    }

    el('chatsList').innerHTML = html;

    el('chatsList').querySelectorAll('.chat-item').forEach((btn) => {
        btn.addEventListener('click', () => selectChat(btn.dataset.chatId));
    });

    highlightActiveChat();
}

function highlightActiveChat() {
    el('chatsList').querySelectorAll('.chat-item').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.chatId === state.currentChatId);
    });
}

function initChatsList() {
    const uid = state.user.uid;

    Promise.all([
        ensureChatDoc('global', { type: 'global', participants: [], names: {} }),
        ensureChatDoc(`ai_${uid}`, { type: 'ai', participants: [uid], names: { [uid]: state.user.name } }),
    ]).catch(console.error);

    const q = query(collection(db, 'chats'), where('participants', 'array-contains', uid));
    state.chatsUnsub = onSnapshot(q, (snap) => {
        const dmChats = [];
        snap.forEach((d) => {
            const data = d.data();
            if (data.type === 'dm') dmChats.push({ id: d.id, ...data });
        });
        dmChats.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
        renderChatsList(dmChats);
    }, console.error);
}

// ===================================================================
// НОВЫЙ ЛИЧНЫЙ ЧАТ
// ===================================================================

function initNewChatModal() {
    const overlay = el('newChatModal');
    el('newChatBtn').addEventListener('click', () => {
        el('newChatEmail').value = '';
        el('newChatMsg').textContent = '';
        el('newChatMsg').className = 'modal-msg';
        overlay.classList.add('active');
        el('newChatEmail').focus();
    });
    el('newChatCancel').addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });

    el('newChatConfirm').addEventListener('click', async () => {
        const email = el('newChatEmail').value.trim().toLowerCase();
        const msg = el('newChatMsg');
        if (!email) { msg.textContent = 'Введите email'; msg.className = 'modal-msg error'; return; }
        if (email === state.user.email) { msg.textContent = 'Это ваш собственный email'; msg.className = 'modal-msg error'; return; }

        msg.textContent = 'Ищем пользователя...';
        msg.className = 'modal-msg';

        try {
            const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
            const snap = await new Promise((resolve, reject) => {
                const unsub = onSnapshot(q, (s) => { unsub(); resolve(s); }, reject);
            });

            if (snap.empty) {
                msg.textContent = 'Пользователь с таким email не найден';
                msg.className = 'modal-msg error';
                return;
            }

            const otherDoc = snap.docs[0];
            const otherUid = otherDoc.id;
            const otherName = otherDoc.data().name || email.split('@')[0];
            const dmId = [state.user.uid, otherUid].sort().join('_');

            await ensureChatDoc(dmId, {
                type: 'dm',
                participants: [state.user.uid, otherUid],
                names: { [state.user.uid]: state.user.name, [otherUid]: otherName },
            });

            overlay.classList.remove('active');
            selectChat(dmId, { type: 'dm', title: otherName, sub: email });
        } catch (err) {
            console.error(err);
            msg.textContent = 'Ошибка поиска, попробуйте ещё раз';
            msg.className = 'modal-msg error';
        }
    });
}

// ===================================================================
// ОТКРЫТИЕ ЧАТА И СООБЩЕНИЯ
// ===================================================================

function chatDisplayMeta(chatId) {
    if (chatId.startsWith('ai_')) return { type: 'ai', title: 'AI-помощник', sub: 'Отвечает нейросеть', avatarClass: 'bot', avatarChar: '🤖' };
    if (chatId === 'global') return { type: 'global', title: 'Общий чат', sub: 'Видят все пользователи', avatarClass: 'global', avatarChar: '🌐' };
    return null; // для dm передаётся явно при выборе
}

function selectChat(chatId, dmMeta) {
    state.currentChatId = chatId;
    state.replyTarget = null;
    el('replyBar').classList.remove('active');

    let meta = chatDisplayMeta(chatId);
    if (!meta) {
        meta = dmMeta
            ? { type: 'dm', title: dmMeta.title, sub: dmMeta.sub, avatarClass: '', avatarChar: initials(dmMeta.title) }
            : { type: 'dm', title: 'Личный чат', sub: '', avatarClass: '', avatarChar: '?' };
    }
    state.currentChatMeta = meta;

    el('emptyState').style.display = 'none';
    el('messagesArea').style.display = 'flex';
    el('inputArea').style.display = 'flex';
    el('hintBar').style.display = 'block';
    el('chatHeader').style.display = 'flex';

    el('chHeaderTitle').textContent = meta.title;
    el('chHeaderSub').textContent = meta.sub;
    const avatar = el('chHeaderAvatar');
    avatar.textContent = meta.avatarChar;
    avatar.className = 'ch-avatar ' + meta.avatarClass;

    highlightActiveChat();
    listenMessages(chatId);
}

function listenMessages(chatId) {
    if (state.messagesUnsub) state.messagesUnsub();

    const q = query(collection(db, 'chats', chatId, 'messages'), limit(300));
    state.messagesUnsub = onSnapshot(q, (snap) => {
        const msgs = [];
        snap.forEach((d) => msgs.push({ id: d.id, ...d.data() }));
        msgs.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
        renderMessages(msgs);
    }, console.error);
}

function renderMessages(msgs) {
    const container = el('messagesArea');
    const wasNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 60;
    container.innerHTML = '';

    if (!msgs.length) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-faint);padding:30px;font-size:13px;">Сообщений пока нет. Напишите первым или введите <code style="color:var(--amber)">!загадка</code></div>`;
        return;
    }

    msgs.forEach((m) => container.appendChild(renderMessageRow(m)));

    if (wasNearBottom || true) container.scrollTop = container.scrollHeight;
}

function renderMessageRow(m) {
    const row = document.createElement('div');
    const mine = m.senderId === state.user.uid;

    if (m.type === 'system') {
        row.className = 'msg-row system';
        row.innerHTML = `<div class="msg-bubble">${escapeHtml(m.text)}</div>`;
        return row;
    }

    if (m.type === 'riddle') {
        row.className = 'msg-row theirs';
        const solved = !!m.solved;
        row.innerHTML = `
            <div class="msg-sender">🔮 Загадочник</div>
            <div class="riddle-card ${solved ? 'solved' : 'pulsing'}">
                <div class="rc-label">🕯️ ${solved ? 'Загадка разгадана' : 'Новая загадка'}</div>
                <div class="rc-text">${escapeHtml(m.text)}</div>
                <div class="rc-status">${solved ? `Отгадал(а): ${escapeHtml(m.solvedByName || '')}` : 'Ответьте на это сообщение своей версией'}</div>
                <button class="rc-reply-btn">Ответить на загадку</button>
            </div>`;
        const btn = row.querySelector('.rc-reply-btn');
        if (btn) {
            btn.addEventListener('click', () => setReplyTarget({ id: m.id, senderName: 'Загадочник', text: m.text, isRiddle: true, solved }));
        }
        return row;
    }

    row.className = 'msg-row ' + (mine ? 'mine' : 'theirs');
    let html = '';
    if (!mine) html += `<div class="msg-sender">${escapeHtml(m.senderName || 'Пользователь')}</div>`;
    if (m.replyTo) {
        html += `<div class="msg-reply-quote">↩ ${escapeHtml(m.replyTo.senderName)}: ${escapeHtml((m.replyTo.text || '').slice(0, 60))}</div>`;
    }
    html += `<div class="msg-bubble">${escapeHtml(m.text)}</div>`;
    const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    html += `<div class="msg-time">${time}</div>`;
    html += `<div class="msg-actions"><button class="reply-btn">↩ Ответить</button></div>`;
    row.innerHTML = html;

    row.querySelector('.reply-btn')?.addEventListener('click', () => {
        setReplyTarget({ id: m.id, senderName: m.senderName || 'Пользователь', text: m.text, isRiddle: false });
    });

    return row;
}

function setReplyTarget(target) {
    state.replyTarget = target;
    el('replyBar').classList.add('active');
    el('replyToName').textContent = target.senderName;
    el('replyToText').textContent = (target.text || '').slice(0, 80);
    el('messageInput').focus();
}

function clearReplyTarget() {
    state.replyTarget = null;
    el('replyBar').classList.remove('active');
}

// ===================================================================
// ОТПРАВКА СООБЩЕНИЙ / ЗАГАДКИ / AI
// ===================================================================

async function postMessage(chatId, fields) {
    await addDoc(collection(db, 'chats', chatId, 'messages'), { ...fields, createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: (fields.text || '').slice(0, 60),
        lastMessageAt: serverTimestamp(),
    }).catch(() => {});
}

function addTypingRow() {
    const container = el('messagesArea');
    const row = document.createElement('div');
    row.className = 'msg-row theirs';
    row.id = 'typingRow';
    row.innerHTML = `<div class="msg-bubble typing-dots"><span></span><span></span><span></span></div>`;
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

function removeTypingRow() {
    el('typingRow')?.remove();
}

async function triggerRiddle(chatId) {
    const input = el('messageInput');
    const sendBtn = el('sendBtn');
    input.disabled = true;
    sendBtn.disabled = true;
    addTypingRow();
    try {
        const res = await fetch('/api/riddle/generate', { method: 'POST' });
        const data = await res.json();
        removeTypingRow();
        if (data.riddle) {
            await postMessage(chatId, { senderId: 'bot', senderName: 'Загадочник', text: data.riddle, type: 'riddle', solved: false });
        } else {
            await postMessage(chatId, { senderId: 'bot', senderName: 'Загадочник', text: '⚠️ ' + (data.error || 'не получилось придумать загадку'), type: 'system' });
        }
    } catch (err) {
        removeTypingRow();
        await postMessage(chatId, { senderId: 'bot', senderName: 'Загадочник', text: '⚠️ Ошибка соединения с нейросетью', type: 'system' });
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
    }
}

async function sendMessage() {
    const input = el('messageInput');
    const text = input.value.trim();
    if (!text || !state.currentChatId) return;

    const chatId = state.currentChatId;

    if (text.toLowerCase() === '!загадка') {
        input.value = '';
        await triggerRiddle(chatId);
        return;
    }

    const replyTarget = state.replyTarget;
    input.value = '';
    input.disabled = true;
    el('sendBtn').disabled = true;

    try {
        const replyToPayload = replyTarget ? { id: replyTarget.id, senderName: replyTarget.senderName, text: replyTarget.text } : null;

        await postMessage(chatId, {
            senderId: state.user.uid,
            senderName: state.user.name,
            text,
            type: 'text',
            replyTo: replyToPayload,
        });

        // Ответ на нерешённую загадку — проверяем через API
        if (replyTarget && replyTarget.isRiddle && !replyTarget.solved) {
            clearReplyTarget();
            addTypingRow();
            const res = await fetch('/api/riddle/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ riddle: replyTarget.text, answer: text }),
            });
            const data = await res.json();
            removeTypingRow();

            const verdict = data.is_correct === true ? `✅ ${data.message}`
                : data.is_correct === false ? `❌ ${data.message}`
                : `🤔 ${data.message || 'Не удалось проверить ответ'}`;

            await postMessage(chatId, { senderId: 'bot', senderName: 'Загадочник', text: verdict, type: 'system' });

            if (data.is_correct === true) {
                await updateDoc(doc(db, 'chats', chatId, 'messages', replyTarget.id), {
                    solved: true,
                    solvedBy: state.user.uid,
                    solvedByName: state.user.name,
                }).catch(() => {});
            }
        } else {
            clearReplyTarget();
            // В личном AI-чате нейросеть отвечает на каждое сообщение
            if (state.currentChatMeta?.type === 'ai') {
                addTypingRow();
                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text }),
                });
                const data = await res.json();
                removeTypingRow();
                await postMessage(chatId, {
                    senderId: 'bot',
                    senderName: 'AI-помощник',
                    text: data.response || ('⚠️ ' + (data.error || 'ошибка ответа')),
                    type: 'text',
                });
            }
        }
    } catch (err) {
        console.error(err);
        removeTypingRow();
    } finally {
        input.disabled = false;
        el('sendBtn').disabled = false;
        input.focus();
    }
}

function initComposer() {
    el('sendBtn').addEventListener('click', sendMessage);
    el('messageInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
    el('cancelReplyBtn').addEventListener('click', clearReplyTarget);
}

// ===================================================================
// СТАРТ
// ===================================================================

function showApp() {
    el('authContainer').style.display = 'none';
    el('appContainer').classList.add('active');

    el('displayName').textContent = state.user.name;
    el('displayEmail').textContent = state.user.email;
    el('userAvatar').textContent = initials(state.user.name);
}

function showAuth() {
    el('appContainer').classList.remove('active');
    el('authContainer').style.display = 'flex';
    el('emptyState').style.display = 'flex';
    el('messagesArea').style.display = 'none';
    el('inputArea').style.display = 'none';
    el('hintBar').style.display = 'none';
    el('chatHeader').style.display = 'none';
    el('chatsList').innerHTML = '';
    state.currentChatId = null;
    state.currentChatMeta = null;
}

onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
        state.user = null;
        showAuth();
        return;
    }
    try {
        const snap = await getDoc(doc(db, 'users', fbUser.uid));
        const name = snap.exists() ? (snap.data().name || fbUser.email.split('@')[0]) : (fbUser.displayName || fbUser.email.split('@')[0]);
        if (!snap.exists()) await ensureUserDoc(fbUser.uid, name, fbUser.email);
        state.user = { uid: fbUser.uid, name, email: fbUser.email };
        showApp();
        initChatsList();
    } catch (err) {
        console.error(err);
    }
});

initAuthUI();
initNewChatModal();
initComposer();
