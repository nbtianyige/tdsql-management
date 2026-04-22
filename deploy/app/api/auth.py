from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.validators import validate_required, validate_length
from app.utils.auth import hash_password, verify_password, get_current_user, require_role, filter_fields
from functools import wraps

bp = Blueprint('auth', __name__)


def _safe_user(user):
    return {
        'id': user['id'],
        'username': user['username'],
        'role': user['role'],
        'created_at': user.get('created_at', '')
    }


def _migrate_passwords():
    users = load_data('users.json')
    changed = False
    for user in users:
        if not user.get('password', '').startswith('$2b$'):
            user['password'] = hash_password(user['password'])
            changed = True
    if changed:
        save_data('users.json', users)


@bp.route('/register', methods=['POST'])
@jwt_required()
@require_role('admin')
def register():
    data = request.json

    errors = validate_required(data, ['username', 'password'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    username_error = validate_length(data['username'], min_length=3, max_length=50)
    if username_error:
        return jsonify({'error': f'Username: {username_error}'}), 400

    password_error = validate_length(data['password'], min_length=6, max_length=100)
    if password_error:
        return jsonify({'error': f'Password: {password_error}'}), 400

    users = load_data('users.json')

    if any(user['username'] == data['username'] for user in users):
        return jsonify({'error': 'Username already exists'}), 400

    from datetime import datetime
    new_user = {
        'id': get_next_id(users),
        'username': data['username'],
        'password': hash_password(data['password']),
        'role': data.get('role', 'user'),
        'created_at': datetime.now().strftime('%Y-%m-%d')
    }

    users.append(new_user)
    save_data('users.json', users)

    return jsonify(_safe_user(new_user)), 201


@bp.route('/login', methods=['POST'])
def login():
    data = request.json

    errors = validate_required(data, ['username', 'password'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    _migrate_passwords()

    users = load_data('users.json')

    user = next((user for user in users if user['username'] == data['username']), None)
    if not user:
        return jsonify({'error': 'Invalid username or password'}), 401

    if not verify_password(data['password'], user['password']):
        return jsonify({'error': 'Invalid username or password'}), 401

    identity = {'username': user['username'], 'role': user['role']}
    access_token = create_access_token(identity=identity)

    return jsonify({
        'access_token': access_token,
        'user': {'username': user['username'], 'role': user['role']}
    }), 200


@bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    return jsonify({'message': 'Logged out successfully'}), 200


@bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    current_user = get_current_user()
    if current_user:
        return jsonify(current_user), 200
    return jsonify({'error': 'Not authenticated'}), 401


@bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    users = load_data('users.json')
    safe_users = [_safe_user(u) for u in users]
    return jsonify(safe_users), 200


@bp.route('/users', methods=['POST'])
@jwt_required()
@require_role('admin')
def create_user():
    data = request.json

    errors = validate_required(data, ['username', 'password'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    username_error = validate_length(data['username'], min_length=3, max_length=50)
    if username_error:
        return jsonify({'error': f'Username: {username_error}'}), 400

    password_error = validate_length(data['password'], min_length=6, max_length=100)
    if password_error:
        return jsonify({'error': f'Password: {password_error}'}), 400

    users = load_data('users.json')

    if any(user['username'] == data['username'] for user in users):
        return jsonify({'error': 'Username already exists'}), 400

    from datetime import datetime
    new_user = {
        'id': get_next_id(users),
        'username': data['username'],
        'password': hash_password(data['password']),
        'role': data.get('role', 'user'),
        'created_at': datetime.now().strftime('%Y-%m-%d')
    }

    users.append(new_user)
    save_data('users.json', users)

    return jsonify(_safe_user(new_user)), 201


@bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    users = load_data('users.json')
    user = next((u for u in users if u['id'] == user_id), None)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(_safe_user(user)), 200


@bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    data = request.json
    filtered = filter_fields('users', data)

    users = load_data('users.json')
    user = next((u for u in users if u['id'] == user_id), None)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if current_user.get('role') == 'user':
        return jsonify({'error': 'Permission denied'}), 403

    if current_user.get('role') == 'operator':
        if user.get('role') == 'admin':
            return jsonify({'error': 'Permission denied'}), 403
        if 'role' in filtered:
            return jsonify({'error': 'Cannot change user role'}), 403

    if 'username' in filtered:
        username_error = validate_length(filtered['username'], min_length=3, max_length=50)
        if username_error:
            return jsonify({'error': f'Username: {username_error}'}), 400

        if any(u.get('username') == filtered['username'] and u['id'] != user_id for u in users):
            return jsonify({'error': 'Username already exists'}), 400

    if 'password' in filtered:
        password_error = validate_length(filtered['password'], min_length=6, max_length=100)
        if password_error:
            return jsonify({'error': f'Password: {password_error}'}), 400
        filtered['password'] = hash_password(filtered['password'])

    user.update(filtered)
    save_data('users.json', users)

    return jsonify(_safe_user(user)), 200


@bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'Authentication required'}), 401

    if current_user.get('role') == 'user':
        return jsonify({'error': 'Permission denied'}), 403

    users = load_data('users.json')
    user = next((u for u in users if u['id'] == user_id), None)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if user['username'] == 'admin':
        return jsonify({'error': 'Cannot delete admin user'}), 400

    if current_user.get('role') == 'operator':
        if user.get('role') == 'admin':
            return jsonify({'error': 'Permission denied'}), 403

    users = [u for u in users if u['id'] != user_id]
    save_data('users.json', users)

    return jsonify({'message': 'User deleted successfully'}), 200
