import json
import os
import uuid
import time
from flask import Flask, request, jsonify, render_template, send_from_directory
from datetime import datetime

app = Flask(__name__)
app.config['LAST_PANIC_INFO'] = {'status': 'NONE', 'timestamp': None} # מאחסן את מצב הפאניק בזיכרון השרת

# --- הגדרות קבצים ---
DATA_FILE = 'data.json'
UPLOAD_FOLDER = 'uploads' # כאן נשמרים קבצי שירים ופאניק

# יצירת תיקיות אם אינן קיימות
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# --- פונקציות עזר לטעינה ושמירה ---

def load_data():
    """טוען נתונים מקובץ ה-JSON."""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError:
            print("אזהרה: קובץ data.json פגום. מאתחל נתונים.")
    
    # מבנה נתונים בסיסי
    return {
        'songs': [
            {"id": "s1", "name": "צלצול בוקר לדוגמה", "filename": "morning.mp3", "clipStart": 0.0, "clipEnd": 10.0},
        ],
        'events': [
            {"id": "e1", "name": "תחילת יום דוגמה", "time": "08:00", "day": "ראשון", "songId": "s1"},
        ]
    }

def save_data(data):
    """שומר נתונים לקובץ ה-JSON."""
    # מוודא ש-data.json יכיל נתונים בעברית ושמור במבנה יפה
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# טעינת הנתונים בפעם הראשונה
APP_DATA = load_data()


# --- ניתוב ראשי (אתר) ---

@app.route('/')
def index():
    """מציג את דף הבית."""
    return render_template('index.html')

# משרת קבצים סטטיים (שנמצאים בשורש התיקייה)
@app.route('/<filename>')
def serve_static_files(filename):
    return send_from_directory('static', filename)

# משרת קבצים שהועלו (לצורך הורדה על ידי ה-RPi)
@app.route('/uploads/<filename>')
def download_file(filename):
    """מאפשר ל-RPi להוריד את קובץ השיר או הפאניק."""
    return send_from_directory(UPLOAD_FOLDER, filename)


# --- API לאתר (Frontend) ---

@app.route('/api/data', methods=['GET'])
def get_all_data():
    """מחזיר את כל הנתונים (שירים ואירועים) לאתר."""
    # כאן צריך לטעון את הנתונים מחדש אם השרת אינו שומר מצב
    return jsonify(APP_DATA)

@app.route('/api/event', methods=['POST', 'PUT'])
def handle_event():
    # פונקציה מדמה לשמירה/עדכון אירוע
    event_data = request.json
    if request.method == 'POST':
        event_data['id'] = str(uuid.uuid4())
        APP_DATA['events'].append(event_data)
    elif request.method == 'PUT':
        # לוגיקת עדכון מורכבת
        pass
    
    save_data(APP_DATA)
    return jsonify({'message': 'Event handled', 'id': event_data['id']}), 200

@app.route('/api/songs', methods=['POST'])
def handle_song_upload():
    # פונקציה מדמה לשמירת שיר
    metadata = json.loads(request.form.get('metadata', '{}'))
    file = request.files.get('file')
    
    if file and file.filename != 'no_change.txt':
        filename = f"song_{str(uuid.uuid4())}.mp3"
        file.save(os.path.join(UPLOAD_FOLDER, filename))
        metadata['filename'] = filename
        
    if 'id' not in metadata:
        metadata['id'] = str(uuid.uuid4())
        APP_DATA['songs'].append(metadata)
        
    save_data(APP_DATA)
    return jsonify({'message': 'Song metadata saved', 'id': metadata['id']}), 200


# --- API לקריאה מיידית (פאניק) ---

@app.route('/api/panic', methods=['POST'])
def handle_panic_call():
    """מקבל קובץ פאניק, שומר אותו ומעדכן את סטטוס הפאניק המיידי."""
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file part in the request'}), 400
    
    # יצירת שם קובץ ייחודי ושמירתו
    filename = f"panic_{str(uuid.uuid4())}.mp3" 
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)
    
    # עדכון המידע על קריאת הפאניק האחרונה
    app.config['LAST_PANIC_INFO'] = {
        'filename': filename,
        'timestamp': datetime.now().isoformat(),
        'status': 'NEW' # סטטוס חדש שיאותת ל-RPi להפעיל
    }
    
    return jsonify({
        'message': 'Panic file saved. RPi clients should be notified.',
        'filename': filename
    }), 200


# --- API ייעודי ל-Raspberry Pi: בדיקת פאניק ---

@app.route('/api/rpi_panic_check', methods=['GET'])
def rpi_panic_check():
    """
    ה-RPi מבצע קריאה לניתוב זה כדי לבדוק אם יש פאניק חדש.
    """
    panic_info = app.config.get('LAST_PANIC_INFO', {'status': 'NONE'})
    
    if panic_info['status'] == 'NEW':
        # עדכון הסטטוס ל-PENDING כדי למנוע הפעלה על ידי ה-RPi השני
        app.config['LAST_PANIC_INFO']['status'] = 'PENDING'
        return jsonify(panic_info)
    
    return jsonify({'status': 'NONE'}), 200


# --- API ייעודי ל-Raspberry Pi: סינכרון כל הנתונים (לוח זמנים) ---

@app.route('/api/rpi_sync', methods=['GET'])
def rpi_sync():
    """מחזיר את כל הנתונים הדרושים לביצוע (אירועים ושירים)."""
    # קורא את הנתונים ישירות מקובץ ה-JSON כדי להבטיח את הנתונים העדכניים ביותר
    current_data = load_data() 
    return jsonify({
        'events': current_data['events'],
        'songs': current_data['songs']
    })

# --- הרצת השרת ---

if __name__ == '__main__':
    # הפורט ייקבע אוטומטית על ידי Render
    app.run(host='0.0.0.0', port=os.environ.get('PORT', 5000), debug=True)

