// ===== ТОП ОТВЕТОВ НА ЗАГАДКИ =====
// Общая лента: какие загадки были заданы, кто и чем их разгадал.
// Пишется в app.js в коллекцию `riddleSolves` при каждом верном ответе,
// здесь — только чтение и отрисовка.

const { db, collection, query, orderBy, getDocs, limit } = window.fb;

const el = (id) => document.getElementById(id);

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function formatTime(ts) {
    if (!ts?.toDate) return '';
    return ts.toDate().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function loadTopAnswers() {
    const listEl = el('topAnswersList');
    listEl.innerHTML = `<div class="top-loading">Загрузка ленты...</div>`;

    try {
        const q = query(collection(db, 'riddleSolves'), orderBy('solvedAt', 'desc'), limit(20));
        const snap = await getDocs(q);

        if (snap.empty) {
            listEl.innerHTML = `<div class="top-empty">Загадок ещё никто не разгадал</div>`;
            return;
        }

        let html = '';
        snap.forEach((d) => {
            const data = d.data();
            html += `
                <div class="answer-row">
                    <div class="answer-riddle">🧩 ${escapeHtml(data.riddleText)}</div>
                    <div class="answer-solver">
                        <span class="answer-solver-name">${escapeHtml(data.solverName || 'Игрок')}</span>
                        ответил(а): <span class="answer-text">«${escapeHtml(data.userAnswer)}»</span>
                    </div>
                    <div class="answer-time">${formatTime(data.solvedAt)}${data.chatTitle ? ' · ' + escapeHtml(data.chatTitle) : ''}</div>
                </div>`;
        });

        listEl.innerHTML = html;
    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<div class="top-empty">Не удалось загрузить ленту ответов</div>`;
    }
}

function initTopAnswersModal() {
    const overlay = el('topAnswersModal');
    el('topAnswersBtn').addEventListener('click', () => {
        overlay.classList.add('active');
        loadTopAnswers();
    });
    el('topAnswersClose').addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
}

initTopAnswersModal();
