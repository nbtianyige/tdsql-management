from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.auth import get_current_user, require_write
from datetime import datetime

bp = Blueprint('migration', __name__)


def _log_activity(action, target_type, target_name, details=None):
    current_user = get_current_user()
    username = current_user.get('username') if current_user else 'system'

    activities = load_data('activities.json')

    activity = {
        'id': get_next_id(activities),
        'action': action,
        'target_type': target_type,
        'target_name': target_name,
        'details': details or {},
        'operator': username,
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    activities.insert(0, activity)

    if len(activities) > 100:
        activities = activities[:100]

    save_data('activities.json', activities)
    return activity


@bp.route('', methods=['GET'])
@jwt_required()
def get_migrations():
    migrations = load_data('migrations.json')
    instances = load_data('instances.json')

    instance_map = {i['id']: i['name'] for i in instances}

    for m in migrations:
        m['source_instance_name'] = instance_map.get(m.get('source_instance_id'), 'Unknown')
        m['target_instance_name'] = instance_map.get(m.get('target_instance_id'), 'Unknown')

    return jsonify(migrations), 200


@bp.route('', methods=['POST'])
@jwt_required()
@require_write
def create_migration():
    data = request.json

    if 'source_instance_id' not in data or 'target_instance_id' not in data:
        return jsonify({'error': 'Missing required fields'}), 400

    if data['source_instance_id'] == data['target_instance_id']:
        return jsonify({'error': 'Source and target cannot be the same'}), 400

    instances = load_data('instances.json')
    source_inst = next((i for i in instances if i['id'] == data['source_instance_id']), None)
    target_inst = next((i for i in instances if i['id'] == data['target_instance_id']), None)

    if not source_inst:
        return jsonify({'error': 'Source instance not found'}), 404
    if not target_inst:
        return jsonify({'error': 'Target instance not found'}), 404

    databases = load_data('databases.json')
    db_users = load_data('db_users.json')

    selected_databases = data.get('databases', [])
    selected_users = data.get('users', [])

    if not selected_databases and not selected_users:
        return jsonify({'error': 'Please select at least one database or user to migrate'}), 400

    migrated_dbs = [d for d in databases if d.get('instance_id') == source_inst['id'] and d['id'] in selected_databases]
    migrated_users = [u for u in db_users if u.get('instance_id') == source_inst['id'] and u['id'] in selected_users]

    current_user = get_current_user()

    migration = {
        'id': get_next_id(load_data('migrations.json')),
        'source_instance_id': source_inst['id'],
        'target_instance_id': target_inst['id'],
        'source_instance_name': source_inst['name'],
        'target_instance_name': target_inst['name'],
        'databases': selected_databases,
        'users': selected_users,
        'migrated_dbs': [d['name'] for d in migrated_dbs],
        'migrated_users': [u['username'] for u in migrated_users],
        'status': 'completed',
        'completed_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'operator': current_user.get('username') if current_user else 'system',
        'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }

    migrations = load_data('migrations.json')
    migrations.append(migration)
    save_data('migrations.json', migrations)

    databases = load_data('databases.json')
    for db in migrated_dbs:
        new_db = {
            'id': get_next_id(databases),
            'name': db['name'],
            'instance_id': target_inst['id']
        }
        databases.append(new_db)
    save_data('databases.json', databases)

    db_users = load_data('db_users.json')
    for user in migrated_users:
        new_user = {
            'id': get_next_id(db_users),
            'username': user['username'],
            'password': user['password'],
            'instance_id': target_inst['id'],
            'app_id': user.get('app_id'),
            'permissions': user.get('permissions', [])
        }
        db_users.append(new_user)
    save_data('db_users.json', db_users)

    source_status = data.get('source_status', 'unused')
    target_status = data.get('target_status', 'online')
    source_inst['status'] = source_status
    target_inst['status'] = target_status
    save_data('instances.json', instances)

    _log_activity(
        '迁移',
        '实例',
        f"{source_inst['name']} -> {target_inst['name']}",
        {
            'databases': migration['migrated_dbs'],
            'users': migration['migrated_users']
        }
    )

    return jsonify(migration), 201


@bp.route('/<int:migration_id>', methods=['GET'])
@jwt_required()
def get_migration(migration_id):
    migrations = load_data('migrations.json')
    migration = next((m for m in migrations if m['id'] == migration_id), None)

    if not migration:
        return jsonify({'error': 'Migration not found'}), 404

    instances = load_data('instances.json')
    instance_map = {i['id']: i['name'] for i in instances}

    migration['source_instance_name'] = instance_map.get(migration.get('source_instance_id'), 'Unknown')
    migration['target_instance_name'] = instance_map.get(migration.get('target_instance_id'), 'Unknown')

    return jsonify(migration), 200
