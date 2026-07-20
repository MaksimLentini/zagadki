// ===== ICON SYSTEM =====
// Красивые SVG-иконки вместо смайликов

const icons = {
    // Основные иконки приложения
    logo: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`,
    
    bot: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
    
    globe: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11z"/></svg>`,
    
    trophy: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M9 21h6v2H9v-2zm8.5-13c1.38 0 2.5-1.12 2.5-2.5V5h2V3h-2V1h-2v2h-6V1H9v2H7v2h2v2.5c0 1.38 1.12 2.5 2.5 2.5h8zm-8-2.5h8V5h-8v2.5z"/></svg>`,
    
    scroll: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>`,
    
    warning: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
    
    check: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>`,
    
    x: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,
    
    reply: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4c6 0 11 5 11 11 0-6-5-11-11-11z"/></svg>`,
    
    send: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.8429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16865241 C3.34915502,0.9115592 2.40734225,0.9115592 1.77946707,1.4592039 C0.994623095,2.00684851 0.837654326,3.0494329 1.15159189,3.99781725 L3.03521743,10.4388102 C3.03521743,10.5959075 3.19218622,10.7530049 3.50612381,10.7530049 L16.6915026,11.5384918 C16.6915026,11.5384918 17.1624089,11.5384918 17.1624089,12.0061365 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/></svg>`,
    
    messages: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
    
    logout: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>`,
    
    new: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
    
    close: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>`,

    riddle: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,

    candle: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M11 2c0 0-1 0-1 2v2c0 0 0 1 1 1s1-1 1-1V4c0-2-1-2-1-2zm0 7c-3.31 0-6 2.69-6 6v7c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-7c0-3.31-2.69-6-6-6z"/></svg>`,

    empty: `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`
};

// Функция для вставки иконки в HTML
function renderIcon(iconName, className = '') {
    const svg = icons[iconName] || icons.empty;
    return `<svg class="icon ${className}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`;
}

// Функция для замены эмодзи на иконки в тексте
function replaceEmojisWithIcons(text) {
    const replacements = {
        '🤖': renderIcon('bot'),
        '🌐': renderIcon('globe'),
        '🏆': renderIcon('trophy'),
        '📜': renderIcon('scroll'),
        '⚠️': renderIcon('warning'),
        '✅': renderIcon('check'),
        '❌': renderIcon('x'),
        '↩': renderIcon('reply'),
        '➤': renderIcon('send'),
        '🔮': renderIcon('logo'),
        '🕯️': renderIcon('candle'),
        '✕': renderIcon('close'),
    };
    
    let result = text;
    for (const [emoji, icon] of Object.entries(replacements)) {
        result = result.replaceAll(emoji, icon);
    }
    return result;
}

// Экспортируем для использования в других скриптах
window.IconSystem = { renderIcon, replaceEmojisWithIcons, icons };
