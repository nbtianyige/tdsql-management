from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.validators import validate_required, validate_length
from app.utils.relations import check_database_user_permissions
from app.utils.auth import require_write, filter_fields

bp = Blueprint('database', __name__)


@bp.route('/', methods=['GET'])
@jwt_required()
def get_databases():
    databases = load_data('databases.json')
    instances = load_data('instances.json')
    clusters = load_data('clusters.json')

    instance_map = {i['id']: i for i in instances}
    cluster_map = {c['id']: c['name'] for c in clusters}

    for db in databases:
        instance = instance_map.get(db.get('instance_id'))
        db['instance_name'] = instance.get('name', 'Unknown') if instance else 'Unknown'
        db['cluster_id'] = instance.get('cluster_id') if instance else None
        db['cluster_name'] = cluster_map.get(instance.get('cluster_id'), 'Unknown') if instance else 'Unknown'

    return jsonify(databases), 200


@bp.route('/', methods=['POST'])
@jwt_required()
@require_write
def create_database():
    data = request.json

    errors = validate_required(data, ['name', 'instance_id'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    name_error = validate_length(data['name'], min_length=1, max_length=100)
    if name_error:
        return jsonify({'error': f'Name: {name_error}'}), 400

    instances = load_data('instances.json')
    if not any(i['id'] == data['instance_id'] for i in instances):
        return jsonify({'error': 'Instance not found'}), 404

    databases = load_data('databases.json')

    if any(d.get('name') == data['name'] and d.get('instance_id') == data['instance_id'] for d in databases):
        return jsonify({'error': 'Database name already exists in this instance'}), 400

    new_database = {
        'id': get_next_id(databases),
        'name': data['name'],
        'instance_id': data['instance_id']
    }

    databases.append(new_database)
    save_data('databases.json', databases)

    return jsonify(new_database), 201


@bp.route('/<int:database_id>', methods=['GET'])
@jwt_required()
def get_database(database_id):
    databases = load_data('databases.json')
    database = next((d for d in databases if d['id'] == database_id), None)
    if not database:
        return jsonify({'error': 'Database not found'}), 404

    instances = load_data('instances.json')
    instance = next((i for i in instances if i['id'] == database.get('instance_id')), None)
    if instance:
        database['instance_name'] = instance['name']

    return jsonify(database), 200


@bp.route('/<int:database_id>', methods=['PUT'])
@jwt_required()
@require_write
def update_database(database_id):
    data = request.json
    filtered = filter_fields('databases', data)

    databases = load_data('databases.json')
    database = next((d for d in databases if d['id'] == database_id), None)
    if not database:
        return jsonify({'error': 'Database not found'}), 404

    if 'name' in filtered:
        name_error = validate_length(filtered['name'], min_length=1, max_length=100)
        if name_error:
            return jsonify({'error': f'Name: {name_error}'}), 400

        if any(d.get('name') == filtered['name'] and d.get('instance_id') == database.get('instance_id') and d['id'] != database_id for d in databases):
            return jsonify({'error': 'Database name already exists in this instance'}), 400

    if 'instance_id' in filtered:
        instances = load_data('instances.json')
        if not any(i['id'] == filtered['instance_id'] for i in instances):
            return jsonify({'error': 'Instance not found'}), 404

    database.update(filtered)
    save_data('databases.json', databases)

    return jsonify(database), 200


@bp.route('/<int:database_id>', methods=['DELETE'])
@jwt_required()
@require_write
def delete_database(database_id):
    databases = load_data('databases.json')
    database = next((d for d in databases if d['id'] == database_id), None)
    if not database:
        return jsonify({'error': 'Database not found'}), 404

    related_users = check_database_user_permissions(database_id)
    if related_users:
        return jsonify({
            'error': 'Cannot delete database with existing user permissions',
            'related_count': len(related_users)
        }), 400

    databases = [d for d in databases if d['id'] != database_id]
    save_data('databases.json', databases)

    return jsonify({'message': 'Database deleted successfully'}), 200


@bp.route('/instance/<int:instance_id>', methods=['GET'])
@jwt_required()
def get_databases_by_instance(instance_id):
    instances = load_data('instances.json')
    if not any(i['id'] == instance_id for i in instances):
        return jsonify({'error': 'Instance not found'}), 404

    databases = load_data('databases.json')
    instance_databases = [d for d in databases if d.get('instance_id') == instance_id]
    return jsonify(instance_databases), 200
