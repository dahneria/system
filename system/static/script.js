// --- משתנים גלובליים ---
const DOM_ELEMENTS = {
    tabs: document.querySelectorAll('.tab-btn'),
    contents: document.querySelectorAll('.tab-content'),
    startBtn: document.getElementById('start-record'),
    stopBtn: document.getElementById('stop-record'),
    sendPanicBtn: document.getElementById('send-panic'),
    playback: document.getElementById('panic-playback'),
    recordStatus: document.getElementById('record-status'),
    songList: document.getElementById('song-list'),
    addSongBtn: document.getElementById('add-song-btn'),
    addSongModal: document.getElementById('add-song-modal'),
    cancelSongBtn: document.getElementById('cancel-song-btn'),
    saveSongBtn: document.getElementById('save-song-btn'),
    newSongName: document.getElementById('new-song-name'),
    newSongFile: document.getElementById('new-song-file'),
    waveform: document.getElementById('waveform'),
    clipStartLabel: document.getElementById('clip-start-label'),
    clipEndLabel: document.getElementById('clip-end-label'),
    clipStartRange: document.getElementById('clip-start-range'),
    clipEndRange: document.getElementById('clip-end-range'),
    songForm: document.getElementById('song-form'),
    eventsList: document.getElementById('events-list'),
    openEventModalBtn: document.getElementById('open-event-modal'),
    eventModal: document.getElementById('event-modal'),
    cancelEventBtn: document.getElementById('cancel-event-btn'),
    saveEventBtn: document.getElementById('save-event-btn'),
    newEventName: document.getElementById('new-event-name'),
    newEventTime: document.getElementById('new-event-time'),
    newEventDay: document.getElementById('new-event-day'),
    eventSongSelect: document.getElementById('event-song-select'),
    eventForm: document.getElementById('event-form')
};

let songs = [];
let events = [];
let mediaRecorder;
let audioChunks = [];
let audioBuffer;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const canvasCtx = DOM_ELEMENTS.waveform.getContext('2d');
let currentSongId = -1;
let isSongEditMode = false;
let isEditMode = false;
let editingEventIndex = -1;
let panicAudioBlob = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initPanicRecorder();
    initSongsManager();
    initEventsManager();
    
    // יש לתקן את מיקום השמירה - לדוגמה LocalStorage
    loadDataFromLocal();
    requestMicrophoneAccess();
});

// --- טעינת נתונים מקומית ---
function loadDataFromLocal() {
    const localSongs = localStorage.getItem('songs');
    const localEvents = localStorage.getItem('events');

    songs = localSongs ? JSON.parse(localSongs) : [];
    events = localEvents ? JSON.parse(localEvents) : [];

    renderSongList();
    renderEvents();
}

// --- שמירת נתונים מקומית ---
function saveDataToLocal() {
    // יש לתקן את מיקום השמירה
    localStorage.setItem('songs', JSON.stringify(songs));
    localStorage.setItem('events', JSON.stringify(events));
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

// --- קריאה מיידית (פאניקה) ---
function initPanicRecorder() {
    DOM_ELEMENTS.startBtn.addEventListener('click', async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunks = [];
            mediaRecorder.ondataavailable = e => { if(e.data.size>0) audioChunks.push(e.data); };
            mediaRecorder.onstop = () => {
                panicAudioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType.split(';')[0] });
                DOM_ELEMENTS.playback.src = URL.createObjectURL(panicAudioBlob);
                DOM_ELEMENTS.stopBtn.disabled = true;
                DOM_ELEMENTS.sendPanicBtn.disabled = false;
                DOM_ELEMENTS.startBtn.disabled = false;
                DOM_ELEMENTS.recordStatus.textContent = "הקלטה הושלמה.";
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            DOM_ELEMENTS.recordStatus.textContent = "🔴 מקליט...";
            DOM_ELEMENTS.startBtn.disabled = true;
            DOM_ELEMENTS.stopBtn.disabled = false;
            DOM_ELEMENTS.sendPanicBtn.disabled = true;
        } catch(err) {
            DOM_ELEMENTS.recordStatus.textContent = "❌ שגיאה בגישה למיקרופון.";
            DOM_ELEMENTS.startBtn.disabled = true;
        }
    });

    DOM_ELEMENTS.stopBtn.addEventListener('click', () => {
        if(mediaRecorder && mediaRecorder.state==='recording') mediaRecorder.stop();
    });

    DOM_ELEMENTS.sendPanicBtn.addEventListener('click', () => {
        if(!panicAudioBlob) return alert('⚠️ אין הקלטה לשליחה.');
        alert('✅ קריאה נשלחה! (ללא שמירה חיצונית)');
        panicAudioBlob = null;
        DOM_ELEMENTS.playback.src = '';
    });
}

// --- ניהול שירים ---
function initSongsManager() {
    DOM_ELEMENTS.addSongBtn.addEventListener('click', () => openSongModal(false));
    DOM_ELEMENTS.cancelSongBtn.addEventListener('click', () => DOM_ELEMENTS.addSongModal.style.display='none');
    DOM_ELEMENTS.newSongFile.addEventListener('change', loadWaveform);
    DOM_ELEMENTS.songForm.addEventListener('submit', saveSong);
    DOM_ELEMENTS.clipStartRange.addEventListener('input', updateClipRange);
    DOM_ELEMENTS.clipEndRange.addEventListener('input', updateClipRange);
}

function openSongModal(isEdit, songData={}) {
    isSongEditMode = isEdit;
    currentSongId = songData.id || -1;
    DOM_ELEMENTS.addSongModal.style.display='flex';
    DOM_ELEMENTS.newSongName.value = songData.name || '';
    DOM_ELEMENTS.newSongFile.value = '';
    DOM_ELEMENTS.saveSongBtn.textContent = isEdit ? 'שמור שינויים' : 'שמור שיר';

    audioBuffer = null;
    canvasCtx.clearRect(0,0,DOM_ELEMENTS.waveform.width, DOM_ELEMENTS.waveform.height);
    DOM_ELEMENTS.clipStartRange.value=0;
    DOM_ELEMENTS.clipEndRange.value=0;
    DOM_ELEMENTS.clipStartRange.max=10;
    DOM_ELEMENTS.clipEndRange.max=10;
    DOM_ELEMENTS.clipStartLabel.textContent="0.00 שניות";
    DOM_ELEMENTS.clipEndLabel.textContent="0.00 שניות";
}

// --- טעינת Waveform ---
function loadWaveform(e){
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e){
        audioCtx.decodeAudioData(e.target.result).then(decodedData=>{
            audioBuffer = decodedData;
            const duration = audioBuffer.duration;
            DOM_ELEMENTS.clipStartRange.max = duration.toFixed(2);
            DOM_ELEMENTS.clipEndRange.max = duration.toFixed(2);
            DOM_ELEMENTS.clipStartRange.value=0;
            DOM_ELEMENTS.clipEndRange.value=duration.toFixed(2);
            drawWaveform(0,duration);
            updateClipRange();
        });
    };
    reader.readAsArrayBuffer(file);
}

// --- ציור Waveform ---
function drawWaveform(clipStart=0, clipEnd=0){
    if(!audioBuffer) return;
    const width=DOM_ELEMENTS.waveform.width, height=DOM_ELEMENTS.waveform.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length/width);
    const amp = height/2;
    canvasCtx.clearRect(0,0,width,height);
    canvasCtx.fillStyle='#1c7ed6';
    for(let i=0;i<width;i++){
        let min=1,max=-1;
        for(let j=0;j<step;j++){
            const d=data[(i*step)+j]; if(d<min) min=d; if(d>max) max=d;
        }
        canvasCtx.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
    }
    const duration=audioBuffer.duration;
    const startX=(clipStart/duration)*width, endX=(clipEnd/duration)*width;
    canvasCtx.strokeStyle='red'; canvasCtx.lineWidth=2;
    canvasCtx.beginPath(); canvasCtx.moveTo(startX,0); canvasCtx.lineTo(startX,height); canvasCtx.stroke();
    canvasCtx.strokeStyle='green'; canvasCtx.beginPath(); canvasCtx.moveTo(endX,0); canvasCtx.lineTo(endX,height); canvasCtx.stroke();
}

// --- עדכון טווח חיתוך ---
function updateClipRange(){
    let start=parseFloat(DOM_ELEMENTS.clipStartRange.value);
    let end=parseFloat(DOM_ELEMENTS.clipEndRange.value);
    if(end<start) DOM_ELEMENTS.clipEndRange.value=start;
    DOM_ELEMENTS.clipStartLabel.textContent=start.toFixed(2)+' שניות';
    DOM_ELEMENTS.clipEndLabel.textContent=end.toFixed(2)+' שניות';
    if(audioBuffer) drawWaveform(start,end);
}

// --- שמירת שיר מקומית ---
function saveSong(e){
    e.preventDefault();
    const name = DOM_ELEMENTS.newSongName.value.trim();
    const clipStart=parseFloat(DOM_ELEMENTS.clipStartRange.value);
    const clipEnd=parseFloat(DOM_ELEMENTS.clipEndRange.value);
    if(!name || isNaN(clipStart) || isNaN(clipEnd) || clipEnd<=clipStart) return alert('⚠️ יש למלא שם שיר ולהגדיר טווח חיתוך תקין.');
    
    let songData = { id: isSongEditMode ? currentSongId : Date.now(), name, clipStart, clipEnd };
    if(isSongEditMode){
        songs = songs.map(s => s.id===currentSongId ? songData : s);
    } else { songs.push(songData); }
    saveDataToLocal(); // יש לתקן את מיקום השמירה
    DOM_ELEMENTS.addSongModal.style.display='none';
    renderSongList();
    alert('✅ השיר נשמר בהצלחה!');
}

// --- מחיקת שיר ---
function removeSong(id){
    if(confirm('בטוח/ה שברצונך למחוק שיר זה?')){
        songs = songs.filter(s => s.id!==id);
        saveDataToLocal(); // יש לתקן את מיקום השמירה
        renderSongList();
    }
}
window.removeSong = removeSong;
window.editSong = id=>{
    const songToEdit=songs.find(s=>s.id==id);
    if(songToEdit) openSongModal(true,songToEdit);
};

// --- ניהול אירועים ---
function initEventsManager(){
    DOM_ELEMENTS.openEventModalBtn.addEventListener('click',()=>openEventModal(false));
    DOM_ELEMENTS.cancelEventBtn.addEventListener('click',()=>DOM_ELEMENTS.eventModal.style.display='none');
    DOM_ELEMENTS.eventForm.addEventListener('submit',handleSaveEvent);
}

function openEventModal(isEdit,eventData={}){
    DOM_ELEMENTS.newEventName.value=eventData.name||'';
    DOM_ELEMENTS.newEventTime.value=eventData.time||'09:00';
    DOM_ELEMENTS.newEventDay.value=eventData.day||'ראשון';
    DOM_ELEMENTS.saveEventBtn.textContent=isEdit?'שמור שינויים':'שמור אירוע';
    isEditMode=isEdit; editingEventIndex=eventData.id||-1;

    DOM_ELEMENTS.eventSongSelect.innerHTML='<option value="">בחר שיר...</option>';
    songs.forEach(song=>{
        const option=document.createElement('option');
        option.value=song.id;
        option.textContent=song.name;
        if(song.id===eventData.songId) option.selected=true;
        DOM_ELEMENTS.eventSongSelect.appendChild(option);
    });

    DOM_ELEMENTS.eventModal.style.display='flex';
}

function handleSaveEvent(e){
    e.preventDefault();
    const name=DOM_ELEMENTS.newEventName.value.trim();
    const time=DOM_ELEMENTS.newEventTime.value;
    const day=DOM_ELEMENTS.newEventDay.value;
    const songId=DOM_ELEMENTS.eventSongSelect.value;
    if(!name||name.length<2) return alert('⚠️ יש להזין שם אירוע תקין.');
    if(!time||!/^\d{2}
