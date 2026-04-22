from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.validators import validate_required, validate_length, validate_port
from app.utils.relations import check_instance_databases, check_instance_users
from app.utils.auth import require_write, filter_fields

bp = Blueprint('instance', __name__)


@bp.route('', methods=['GET'], strict_slashes=False)
@bp.route('/', methods=['GET'])
@jwt_required()
def get_instances():
    instances = load_data('instances.json')
    instances = [i for i in instances if i.get('status') != 'deleted']

    clusters = load_data('clusters.json')
    cluster_map = {c['id']: c['name'] for c in clusters if c.get('status') != 'deleted'}

    for inst in instances:
        inst['cluster_name'] = cluster_map.get(inst.get('cluster_id'), 'Unknown')

    return jsonify(instances), 200


@bp.route('', methods=['POST'])
@jwt_required()
@require_write
def create_instance():
    data = request.json

    errors = validate_required(data, ['name', 'cluster_id'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    name_error = validate_length(data['name'], min_length=1, max_length=100)
    if name_error:
        return jsonify({'error': f'Name: {name_error}'}), 400

    clusters = load_data('clusters.json')
    if not any(c['id'] == data['cluster_id'] for c in clusters):
        return jsonify({'error': 'Cluster not found'}), 404

    if 'internal_port' in data:
        port_error = validate_port(data['internal_port'])
        if port_error:
            return jsonify({'error': f'Internal port: {port_error}'}), 400

    if 'external_port' in data:
        port_error = validate_port(data['external_port'])
        if port_error:
            return jsonify({'error': f'External port: {port_error}'}), 400

    instances = load_data('instances.json')

    if any(i.get('name') == data['name'] and i.get('cluster_id') == data['cluster_id'] for i in instances):
        return jsonify({'error': 'Instance with this name already exists in the selected cluster'}), 400

    new_instance = {
        'id': get_next_id(instances),
        'name': data['name'],
        'cluster_id': data['cluster_id'],
        'internal_port': data.get('internal_port', 3306),
        'external_port': data.get('external_port', 3306),
        'description': data.get('description', ''),
        'status': data.get('status', 'unused')
    }

    instances.append(new_instance)
    save_data('instances.json', instances)

    return jsonify(new_instance), 201


@bp.route('/<int:instance_id>', methods=['GET'])
@jwt_required()
def get_instance(instance_id):
    instances = load_data('instances.json')
    instance = next((i for i in instances if i['id'] == instance_id), None)
    if not instance:
        return jsonify({'error': 'Instance not found'}), 404

    clusters = load_data('clusters.json')
    cluster = next((c for c in clusters if c['id'] == instance.get('cluster_id')), None)
    if cluster:
        instance['cluster_name'] = cluster['name']

    return jsonify(instance), 200


@bp.route('/<int:instance_id>', methods=['PUT'])
@jwt_required()
@require_write
def update_instance(instance_id):
    data = request.json
    filtered = filter_fields('instances', data)

    instances = load_data('instances.json')
    instance = next((i for i in instances if i['id'] == instance_id), None)
    if not instance:
        return jsonify({'error': 'Instance not found'}), 404

    if 'name' in filtered:
        name_error = validate_length(filtered['name'], min_length=1, max_length=100)
        if name_error:
            return jsonify({'error': f'Name: {name_error}'}), 400

        current_cluster_id = filtered.get('cluster_id', instance['cluster_id'])
        if any(i.get('name') == filtered['name'] and i.get('cluster_id') == current_cluster_id and i['id'] != instance_id for i in instances):
            return jsonify({'error': 'Instance with this name already exists in the selected cluster'}), 400

    if 'cluster_id' in filtered:
        clusters = load_data('clusters.json')
        if not any(c['id'] == filtered['cluster_id'] for c in clusters):
            return jsonify({'error': 'Cluster not found'}), 404

    if 'internal_port' in filtered:
        port_error = validate_port(filtered['internal_port'])
        if port_error:
            return jsonify({'error': f'Internal port: {port_error}'}), 400

    if 'external_port' in filtered:
        port_error = validate_port(filtered['external_port'])
        if port_error:
            return jsonify({'error': f'External port: {port_error}'}), 400

    instance.update(filtered)
    save_data('instances.json', instances)

    return jsonify(instance), 200


@bp.route('/<int:instance_id>', methods=['DELETE'])
@jwt_required()
@require_write
def delete_instance(instance_id):
    instances = load_data('instances.json')
    instance = next((i for i in instances if i['id'] == instance_id), None)
    if not instance or instance.get('status') == 'deleted':
        return jsonify({'error': 'Instance not found'}), 404

    instance['status'] = 'deleted'
    save_data('instances.json', instances)

    return jsonify({'message': 'Instance deleted successfully'}), 200


@bp.route('/cluster/<int:cluster_id>', methods=['GET'])
@jwt_required()
def get_cluster_instances(cluster_id):
    instances = load_data('instances.json')
    instances = [i for i in instances if i.get('cluster_id') == cluster_id and i.get('status') != 'deleted']
    return jsonify(instances), 200


@bp.route('/<int:instance_id>/related', methods=['GET'])
@jwt_required()
@require_write
def get_instance_related(instance_id):
    instances = load_data('instances.json')
    instance = next((i for i in instances if i['id'] == instance_id), None)
    if not instance or instance.get('status') == 'deleted':
        return jsonify({'error': 'Instance not found'}), 404

    databases = load_data('databases.json')
    db_users = load_data('db_users.json')

    related_databases = [d for d in databases if d.get('instance_id') == instance_id and d.get('status') != 'deleted']
    related_users = [u for u in db_users if u.get('instance_id') == instance_id and u.get('status') != 'deleted']

    return jsonify({
        'databases': related_databases,
        'users': related_users
    }), 200
