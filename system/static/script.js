// --- JAVASCRIPT: לוגיקה בסיסית וטיפול במודלים ---

// שימוש במשתנים גלובליים ספציפיים וקבועים
const DOM_ELEMENTS = {
    // טאבים
    tabs: document.querySelectorAll('.tab-btn'),
    contents: document.querySelectorAll('.tab-content'),
    // קריאה מיידית
    startBtn: document.getElementById('start-record'),
    stopBtn: document.getElementById('stop-record'),
    sendPanicBtn: document.getElementById('send-panic'),
    playback: document.getElementById('panic-playback'),
    recordStatus: document.getElementById('record-status'),
    immediateCallCard: document.getElementById('immediate-call'),
    // שירים
    songForm: document.getElementById('song-form'),
    addSongModal: document.getElementById('add-song-modal'),
    cancelSongBtn: document.getElementById('cancel-song-btn'),
    saveSongBtn: document.getElementById('save-song-btn'),
    newSongName: document.getElementById('new-song-name'),
    newSongFile: document.getElementById('new-song-file'),
    songLoadingSpinner: document.getElementById('song-loading-spinner'),
    // אירועים
    eventForm: document.getElementById('event-form'),
    eventModal: document.getElementById('event-modal'),
    cancelEventBtn: document.getElementById('cancel-event-btn'),
    openEventModalBtn: document.getElementById('open-event-modal'),
    saveEventBtn: document.getElementById('save-event-btn'),
    eventLoadingSpinner: document.getElementById('event-loading-spinner'),
    // נתונים
    eventsList: document.getElementById('events-list'),
    songList: document.getElementById('song-list'),
    eventSongSelect: document.getElementById('event-song-select'),
};

let mediaRecorder;
let audioChunks = [];
let panicAudioBlob = null;
let songs = [{"id": "s1", "name": "צלצול בוקר לדוגמה"}]; // נתונים מדומים
let events = [{"id": "e1", "name": "תחילת יום דוגמה", "time": "08:00", "day": "ראשון", "songId": "s1"}];

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initPanicRecorder();
    initSongModal();
    initEventModal();
    renderData(); // טעינת נתונים מדומים
    requestMicrophoneAccess();
});

// --- פונקציות עזר לטעינה ---
function startLoading(modalElement, spinnerElement, buttonElement, text = 'שומר...') {
    modalElement.classList.add('loading-mode');
    spinnerElement.style.display = 'block';
    buttonElement.disabled = true;
    buttonElement.textContent = text;
}

function stopLoading(modalElement, spinnerElement, buttonElement, newText = 'שמור') {
    modalElement.classList.remove('loading-mode');
    spinnerElement.style.display = 'none';
    buttonElement.disabled = false;
    buttonElement.textContent = newText;
    // סגירת המודל לאחר סיום הפעולה
    modalElement.style.display = 'none'; 
}

// --- טאבים ---
function initTabs() {
    DOM_ELEMENTS.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            DOM_ELEMENTS.eventModal.style.display = 'none';
            DOM_ELEMENTS.addSongModal.style.display = 'none';
            
            DOM_ELEMENTS.tabs.forEach(t => t.classList.remove('active'));
            DOM_ELEMENTS.contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}
async function requestMicrophoneAccess() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        DOM_ELEMENTS.recordStatus.textContent = "✅ המיקרופון נגיש.";
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (err) {
        DOM_ELEMENTS.recordStatus.textContent = "⚠️ גישה למיקרופון נחסמה.";
        DOM_ELEMENTS.startBtn.disabled = true;
        return false;
    }
}
// --- מימוש קריאה מיידית (פאניקה) ---
function initPanicRecorder() {
    DOM_ELEMENTS.startBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType.split(';')[0];
                panicAudioBlob = new Blob(audioChunks, { type: mimeType });
                DOM_ELEMENTS.playback.src = URL.createObjectURL(panicAudioBlob);
                
                DOM_ELEMENTS.stopBtn.disabled = true;
                DOM_ELEMENTS.sendPanicBtn.disabled = false;
                DOM_ELEMENTS.startBtn.disabled = false;
                DOM_ELEMENTS.recordStatus.textContent = "הקלטה הושלמה. ניתן לשלוח או להקליט מחדש.";
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            DOM_ELEMENTS.recordStatus.textContent = "🔴 מקליט...";
            DOM_ELEMENTS.startBtn.disabled = true;
            DOM_ELEMENTS.stopBtn.disabled = false;
            DOM_ELEMENTS.sendPanicBtn.disabled = true;

        } catch (err) {
            alert(`שגיאה בגישה למיקרופון: ${err.message}.`);
        }
    });

    DOM_ELEMENTS.stopBtn.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            DOM_ELEMENTS.recordStatus.textContent = "מעבד הקלטה...";
        }
    });

    DOM_ELEMENTS.sendPanicBtn.addEventListener('click', async () => {
        if (!panicAudioBlob) return alert('⚠️ אין הקלטה לשליחה.');
        
        DOM_ELEMENTS.sendPanicBtn.disabled = true;
        DOM_ELEMENTS.recordStatus.textContent = "🚀 שולח ומפעיל קריאה...";

        const formData = new FormData();
        // שליחת הקובץ כ-mp3 לצורך שמירה בשרת
        formData.append('file', panicAudioBlob, 'panic_message.mp3'); 

        try {
            // סימון טעינה
            DOM_ELEMENTS.immediateCallCard.classList.add('loading-mode');

            // --- כאן נכנסת לוגיקת ה-API האמיתית שלך! ---
            const response = await fetch('/api/panic', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('שגיאה בשליחת הקריאה לשרת');
            
            await new Promise(resolve => setTimeout(resolve, 1500)); // סימולציה של זמן טעינה

            alert('✅ קריאה מיידית נשלחה ונשמרה.');
            
        } catch (err) {
            console.error("שגיאה בהפעלת קריאה מיידית:", err);
            alert('⚠️ שגיאה בהפעלת קריאה מיידית: ' + err.message);
        } finally {
            // סיום טעינה
            DOM_ELEMENTS.immediateCallCard.classList.remove('loading-mode');
            DOM_ELEMENTS.playback.src = '';
            panicAudioBlob = null;
            DOM_ELEMENTS.sendPanicBtn.disabled = true;
            DOM_ELEMENTS.recordStatus.textContent = "מוכן להקלטה...";
        }
    });
}

// --- ניהול מודל שירים ---
function initSongModal() {
    DOM_ELEMENTS.addSongModal.querySelector('#add-song-btn').addEventListener('click', () => {
        DOM_ELEMENTS.addSongModal.style.display = 'flex';
    });
    DOM_ELEMENTS.cancelSongBtn.addEventListener('click', () => DOM_ELEMENTS.addSongModal.style.display = 'none');
    DOM_ELEMENTS.songForm.addEventListener('submit', saveSong);
    // הסרתי את כל לוגיקת ה-Waveform המורכבת
}

// 💾 שמירת שיר (פונקציה ריקה עם טעינה)
async function saveSong(e) {
    e.preventDefault();
    
    const name = DOM_ELEMENTS.newSongName.value.trim();
    if (!name) return alert('⚠️ יש למלא שם שיר.');
    
    // 1. הפעלת מצב טעינה
    startLoading(DOM_ELEMENTS.addSongModal, DOM_ELEMENTS.songLoadingSpinner, DOM_ELEMENTS.saveSongBtn, 'מעלה...');
    
    try {
        // --- כאן נכנסת לוגיקת ה-API האמיתית שלך! ---
        const formData = new FormData();
        formData.append('metadata', JSON.stringify({ name: name, clipStart: 0, clipEnd: 10 }));
        formData.append('file', DOM_ELEMENTS.newSongFile.files[0] || new Blob([""], { type: 'application/octet-stream' }), DOM_ELEMENTS.newSongFile.files[0] ? DOM_ELEMENTS.newSongFile.files[0].name : 'no_change.txt');

        const response = await fetch('/api/songs', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Failed to save song');
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // סימולציה של זמן טעינה

        // הוספת פריט דמה לרשימה
        songs.push({ id: Math.random().toString(36).substring(7), name: name }); 
        renderSongList();

    } catch (err) {
        console.error("שגיאה מדומית בשמירת שיר:", err);
        alert('⚠️ שגיאה בשמירת שיר: ' + err.message);
    } finally {
        // 2. סיום מצב טעינה וסגירת המודל
        stopLoading(DOM_ELEMENTS.addSongModal, DOM_ELEMENTS.songLoadingSpinner, DOM_ELEMENTS.saveSongBtn, 'שמור שיר');
    }
}


// --- ניהול מודל אירועים ---
function initEventModal() {
    DOM_ELEMENTS.openEventModalBtn.addEventListener('click', () => {
        DOM_ELEMENTS.eventModal.style.display = 'flex';
        renderSongSelect();
    });

    DOM_ELEMENTS.cancelEventBtn.addEventListener('click', () => {
        DOM_ELEMENTS.eventModal.style.display = 'none';
    });

    DOM_ELEMENTS.eventForm.addEventListener('submit', handleSaveEvent);
}

// 💾 שמירת אירוע (פונקציה ריקה עם טעינה)
async function handleSaveEvent(e) {
    e.preventDefault();
    
    const name = DOM_ELEMENTS.eventForm.querySelector('#new-event-name').value.trim();
    if (!name) return alert('⚠️ יש למלא שם אירוע.');
    
    // 1. הפעלת מצב טעינה
    startLoading(DOM_ELEMENTS.eventModal, DOM_ELEMENTS.eventLoadingSpinner, DOM_ELEMENTS.saveEventBtn, 'שומר...');
    
    try {
        // --- כאן נכנסת לוגיקת ה-API האמיתית שלך! ---
        const response = await fetch('/api/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: name,
                time: DOM_ELEMENTS.eventForm.querySelector('#new-event-time').value,
                day: DOM_ELEMENTS.eventForm.querySelector('#new-event-day').value,
                songId: DOM_ELEMENTS.eventSongSelect.value
            })
        });

        if (!response.ok) throw new Error('Failed to save event');

        await new Promise(resolve => setTimeout(resolve, 1500)); // סימולציה של זמן טעינה
        
        // הוספת פריט דמה לרשימה
        events.push({ id: Math.random().toString(36).substring(7), name: name, day: 'חדש', time: '00:00', songId: DOM_ELEMENTS.eventSongSelect.value }); 
        renderEvents();

    } catch (err) {
        console.error("שגיאה מדומית בשמירת אירוע:", err);
        alert('⚠️ שגיאה בשמירת אירוע: ' + err.message);
    } finally {
        // 2. סיום מצב טעינה וסגירת המודל
        stopLoading(DOM_ELEMENTS.eventModal, DOM_ELEMENTS.eventLoadingSpinner, DOM_ELEMENTS.saveEventBtn, 'שמור אירוע');
    }
}

// --- רינדור נתונים מדומים ---
function renderData() {
    renderSongList();
    renderEvents();
}
function renderSongSelect() {
    DOM_ELEMENTS.eventSongSelect.innerHTML = '<option value="">בחר שיר...</option>';
    songs.forEach(song => {
        const option = document.createElement('option');
        option.value = String(song.id);
        option.textContent = song.name;
        DOM_ELEMENTS.eventSongSelect.appendChild(option);
    });
}
function renderEvents() {
    DOM_ELEMENTS.eventsList.innerHTML = '';
    events.forEach(ev => {
        const song = songs.find(s => String(s.id) === String(ev.songId));
        const songName = song ? song.name : 'שיר לא קיים';
        
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${ev.day}, ${ev.time}</span>
            <strong>${ev.name}</strong>
            <span class="song-link">${songName}</span>
            <div class="actions">
                <button class="edit" data-id="${ev.id}">✏️</button>
                <button class="del" data-id="${ev.id}">🗑️</button>
            </div>
        `;
        DOM_ELEMENTS.eventsList.appendChild(li);
    });
}
function renderSongList() {
    DOM_ELEMENTS.songList.innerHTML = '';
    songs.forEach(song => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${song.name}</span>
            <div class="actions">
                <button class="edit" data-id="${song.id}">✏️</button>
                <button class="del" data-id="${song.id}">🗑️</button>
            </div>
        `;
        DOM_ELEMENTS.songList.appendChild(li);
    });
}

