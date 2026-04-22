import bcrypt
from flask import request, jsonify
from functools import wraps
from flask_jwt_extended import get_jwt_identity


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def get_current_user():
    identity = get_jwt_identity()
    if identity:
        return {'username': identity.get('username'), 'role': identity.get('role')}
    return None


def require_role(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_user = get_current_user()
            if not current_user:
                return jsonify({'error': 'Authentication required'}), 401
            if current_user.get('role') not in allowed_roles:
                return jsonify({'error': 'Permission denied'}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_write(f):
    return require_role('admin', 'operator')(f)


def require_admin(f):
    return require_role('admin')(f)


ALLOWED_FIELDS = {
    'users': {'username', 'password', 'role', 'created_at'},
    'clusters': {'name', 'description', 'is_xinchuang', 'is_dingjia', 'status', 'created_at'},
    'instances': {'name', 'cluster_id', 'internal_port', 'external_port', 'description', 'status'},
    'databases': {'name', 'instance_id'},
    'db_users': {'username', 'password', 'instance_id', 'app_id', 'permissions'},
    'groups': {'name', 'code', 'type'},
    'staff': {'name', 'code', 'group_id', 'type'},
    'apps': {'name', 'domain', 'developer', 'operator', 'description'},
}


def filter_fields(entity_type: str, data: dict) -> dict:
    allowed = ALLOWED_FIELDS.get(entity_type, set())
    return {k: v for k, v in data.items() if k in allowed}
