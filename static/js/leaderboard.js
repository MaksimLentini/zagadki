// ===== ТОП ИГРОКОВ =====
// Рейтинг по полю users/{uid}.solvedCount — увеличивается в app.js
// каждый раз, когда пользователь первым верно отвечает на загадку.

const { db, collection, query, orderBy, getDocs, limit } = window.fb;

const el = (id) => document.getElementById(id);

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function medalFor(index) {
    return ['🥇', '🥈', '🥉'][index] || `${index + 1}.`;
}

async function loadTopPlayers() {
    const listEl = el('topPlayersList');
    listEl.innerHTML = `<div class="top-loading">Загрузка рейтинга...</div>`;

    try {
        const q = query(collection(db, 'users'), orderBy('solvedCount', 'desc'), limit(10));
        const snap = await getDocs(q);

        if (snap.empty) {
            listEl.innerHTML = `<div class="top-empty">Пока никто не разгадал ни одной загадки — будь первым!</div>`;
            return;
        }

        let html = '';
        let rank = 0;
        snap.forEach((d) => {
            const data = d.data();
            const count = data.solvedCount || 0;
            if (count <= 0) return; // не показываем тех, кто ничего не решил
            html += `
                <div class="top-row">
                    <div class="top-rank">${medalFor(rank)}</div>
                    <div class="top-name">${escapeHtml(data.name || 'Игрок')}</div>
                    <div class="top-count">${count} 🧩</div>
                </div>`;
            rank += 1;
        });

        listEl.innerHTML = html || `<div class="top-empty">Пока никто не разгадал ни одной загадки — будь первым!</div>`;
    } catch (err) {
        console.error(err);
        listEl.innerHTML = `<div class="top-empty">Не удалось загрузить рейтинг</div>`;
    }
}

function initTopPlayersModal() {
    const overlay = el('topPlayersModal');
    el('topPlayersBtn').addEventListener('click', () => {
        overlay.classList.add('active');
        loadTopPlayers();
    });
    el('topPlayersClose').addEventListener('click', () => overlay.classList.remove('active'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
}

initTopPlayersModal();
