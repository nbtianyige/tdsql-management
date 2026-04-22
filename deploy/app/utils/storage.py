import json
import os
import threading

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

_file_locks = {}
_lock_mutex = threading.Lock()


def _get_lock(filename):
    with _lock_mutex:
        if filename not in _file_locks:
            _file_locks[filename] = threading.Lock()
        return _file_locks[filename]


def load_data(filename):
    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        return []
    lock = _get_lock(filename)
    with lock:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)


def save_data(filename, data):
    filepath = os.path.join(DATA_DIR, filename)
    lock = _get_lock(filename)
    with lock:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def get_next_id(data):
    if not data:
        return 1
    return max(item.get('id', 0) for item in data) + 1
