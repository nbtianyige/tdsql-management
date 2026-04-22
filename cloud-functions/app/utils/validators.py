from functools import wraps
from flask import request, jsonify

def validate_json(*required_fields):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not request.json:
                return jsonify({'error': 'Request body must be JSON'}), 400
            
            missing_fields = [field for field in required_fields if field not in request.json]
            if missing_fields:
                return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def validate_required(data, fields):
    errors = []
    for field in fields:
        if field not in data or not data[field]:
            errors.append(f'Missing required field: {field}')
    return errors if errors else None

def validate_length(value, min_length=None, max_length=None):
    if min_length and len(value) < min_length:
        return f'Minimum length is {min_length}'
    if max_length and len(value) > max_length:
        return f'Maximum length is {max_length}'
    return None

def validate_port(port):
    try:
        port_num = int(port)
        if port_num < 1 or port_num > 65535:
            return 'Port must be between 1 and 65535'
    except (ValueError, TypeError):
        return 'Port must be a valid number'
    return None
