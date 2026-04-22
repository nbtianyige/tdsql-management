from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.validators import validate_required, validate_length
from app.utils.auth import require_write, filter_fields

bp = Blueprint('user', __name__)


@bp.route('/db', methods=['GET'])
@jwt_required()
def get_db_users():
    db_users = load_data('db_users.json')
    instances = load_data('instances.json')
    databases = load_data('databases.json')
    clusters = load_data('clusters.json')
    apps = load_data('apps.json')
    staff = load_data('staff.json')

    instance_map = {i['id']: i for i in instances}
    database_map = {d['id']: d['name'] for d in databases}
    cluster_map = {c['id']: c['name'] for c in clusters}
    app_map = {a['id']: a for a in apps}
    staff_map = {s['code']: s['name'] for s in staff}

    for user in db_users:
        instance = instance_map.get(user.get('instance_id'))
        user['instance_name'] = instance.get('name', 'Unknown') if instance else 'Unknown'
        user['cluster_id'] = instance.get('cluster_id') if instance else None
        user['cluster_name'] = cluster_map.get(instance.get('cluster_id'), 'Unknown') if instance else 'Unknown'

        app = app_map.get(user.get('app_id'))
        if app:
            user['app_id'] = app.get('id')
            user['app_name'] = app.get('name', '')
            user['app_domain'] = app.get('domain', '')
            user['app_developer'] = staff_map.get(app.get('developer'), '')
            user['app_operator'] = staff_map.get(app.get('operator'), '')

        user['permissions_detail'] = []
        for perm in user.get('permissions', []):
            db_name = database_map.get(perm.get('database_id'), 'Unknown')
            user['permissions_detail'].append({
                'database_id': perm.get('database_id'),
                'database_name': db_name,
                'privileges': perm.get('privileges', [])
            })

    return jsonify(db_users), 200


@bp.route('/db', methods=['POST'])
@jwt_required()
@require_write
def create_db_user():
    data = request.json

    errors = validate_required(data, ['username', 'password', 'instance_id'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    username_error = validate_length(data['username'], min_length=1, max_length=50)
    if username_error:
        return jsonify({'error': f'Username: {username_error}'}), 400

    password_error = validate_length(data['password'], min_length=1, max_length=100)
    if password_error:
        return jsonify({'error': f'Password: {password_error}'}), 400

    instances = load_data('instances.json')
    if not any(i['id'] == data['instance_id'] for i in instances):
        return jsonify({'error': 'Instance not found'}), 404

    db_users = load_data('db_users.json')

    if any(u.get('username') == data['username'] and u.get('instance_id') == data['instance_id'] for u in db_users):
        return jsonify({'error': 'Username already exists in this instance'}), 400

    new_db_user = {
        'id': get_next_id(db_users),
        'username': data['username'],
        'password': data['password'],
        'instance_id': data['instance_id'],
        'app_id': data.get('app_id'),
        'permissions': data.get('permissions', [])
    }

    db_users.append(new_db_user)
    save_data('db_users.json', db_users)

    return jsonify(new_db_user), 201


@bp.route('/db/<int:user_id>', methods=['GET'])
@jwt_required()
def get_db_user(user_id):
    db_users = load_data('db_users.json')
    db_user = next((u for u in db_users if u['id'] == user_id), None)
    if not db_user:
        return jsonify({'error': 'Database user not found'}), 404

    instances = load_data('instances.json')
    databases = load_data('databases.json')

    instance_map = {i['id']: i['name'] for i in instances}
    database_map = {d['id']: d['name'] for d in databases}

    db_user['instance_name'] = instance_map.get(db_user.get('instance_id'), 'Unknown')

    db_user['permissions_detail'] = []
    for perm in db_user.get('permissions', []):
        db_name = database_map.get(perm.get('database_id'), 'Unknown')
        db_user['permissions_detail'].append({
            'database_id': perm.get('database_id'),
            'database_name': db_name,
            'privileges': perm.get('privileges', [])
        })

    return jsonify(db_user), 200


@bp.route('/db/<int:user_id>', methods=['PUT'])
@jwt_required()
@require_write
def update_db_user(user_id):
    data = request.json
    filtered = filter_fields('db_users', data)

    db_users = load_data('db_users.json')
    db_user = next((u for u in db_users if u['id'] == user_id), None)
    if not db_user:
        return jsonify({'error': 'Database user not found'}), 404

    if 'username' in filtered:
        username_error = validate_length(filtered['username'], min_length=1, max_length=50)
        if username_error:
            return jsonify({'error': f'Username: {username_error}'}), 400

        if any(u.get('username') == filtered['username'] and u.get('instance_id') == db_user.get('instance_id') and u['id'] != user_id for u in db_users):
            return jsonify({'error': 'Username already exists in this instance'}), 400

    if 'password' in filtered:
        password_error = validate_length(filtered['password'], min_length=1, max_length=100)
        if password_error:
            return jsonify({'error': f'Password: {password_error}'}), 400

    if 'instance_id' in filtered:
        instances = load_data('instances.json')
        if not any(i['id'] == filtered['instance_id'] for i in instances):
            return jsonify({'error': 'Instance not found'}), 404

    db_user.update(filtered)
    save_data('db_users.json', db_users)

    apps = load_data('apps.json')
    app_map = {a['id']: a for a in apps}
    staff = load_data('staff.json')
    staff_map = {s['code']: s['name'] for s in staff}

    app = app_map.get(db_user.get('app_id'))
    if app:
        db_user['app_name'] = app.get('name', '')
        db_user['app_domain'] = app.get('domain', '')
        db_user['app_developer'] = staff_map.get(app.get('developer'), '')
        db_user['app_operator'] = staff_map.get(app.get('operator'), '')
    else:
        db_user['app_name'] = ''
        db_user['app_domain'] = ''
        db_user['app_developer'] = ''
        db_user['app_operator'] = ''

    return jsonify(db_user), 200


@bp.route('/db/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_write
def delete_db_user(user_id):
    db_users = load_data('db_users.json')
    db_user = next((u for u in db_users if u['id'] == user_id), None)
    if not db_user:
        return jsonify({'error': 'Database user not found'}), 404

    db_users = [u for u in db_users if u['id'] != user_id]
    save_data('db_users.json', db_users)

    return jsonify({'message': 'Database user deleted successfully'}), 200


@bp.route('/db/instance/<int:instance_id>', methods=['GET'])
@jwt_required()
def get_db_users_by_instance(instance_id):
    instances = load_data('instances.json')
    if not any(i['id'] == instance_id for i in instances):
        return jsonify({'error': 'Instance not found'}), 404

    db_users = load_data('db_users.json')
    instance_users = [u for u in db_users if u.get('instance_id') == instance_id]
    return jsonify(instance_users), 200
