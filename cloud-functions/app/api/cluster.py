from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.validators import validate_required, validate_length
from app.utils.relations import check_cluster_instances
from app.utils.auth import require_write, filter_fields

bp = Blueprint('cluster', __name__)


@bp.route('', methods=['GET'], strict_slashes=False)
@bp.route('/', methods=['GET'])
@jwt_required()
def get_clusters():
    clusters = load_data('clusters.json')
    clusters = [c for c in clusters if c.get('status') != 'deleted']
    return jsonify(clusters), 200


@bp.route('', methods=['POST'], strict_slashes=False)
@bp.route('/', methods=['POST'])
@jwt_required()
@require_write
def create_cluster():
    data = request.json

    errors = validate_required(data, ['name'])
    if errors:
        return jsonify({'error': errors[0]}), 400

    name_error = validate_length(data['name'], min_length=1, max_length=100)
    if name_error:
        return jsonify({'error': f'Name: {name_error}'}), 400

    clusters = load_data('clusters.json')

    if any(c.get('name') == data['name'] and c.get('status') != 'deleted' for c in clusters):
        return jsonify({'error': 'Cluster name already exists'}), 400

    from datetime import datetime
    new_cluster = {
        'id': get_next_id(clusters),
        'name': data['name'],
        'description': data.get('description', ''),
        'is_xinchuang': data.get('is_xinchuang', False),
        'is_dingjia': data.get('is_dingjia', False),
        'status': 'active',
        'created_at': datetime.now().strftime('%Y-%m-%d')
    }

    clusters.append(new_cluster)
    save_data('clusters.json', clusters)

    return jsonify(new_cluster), 201


@bp.route('/<int:cluster_id>', methods=['GET'])
@jwt_required()
def get_cluster(cluster_id):
    clusters = load_data('clusters.json')
    cluster = next((c for c in clusters if c['id'] == cluster_id), None)
    if not cluster or cluster.get('status') == 'deleted':
        return jsonify({'error': 'Cluster not found'}), 404
    return jsonify(cluster), 200


@bp.route('/<int:cluster_id>', methods=['PUT'])
@jwt_required()
@require_write
def update_cluster(cluster_id):
    data = request.json
    filtered = filter_fields('clusters', data)

    clusters = load_data('clusters.json')
    cluster = next((c for c in clusters if c['id'] == cluster_id), None)
    if not cluster or cluster.get('status') == 'deleted':
        return jsonify({'error': 'Cluster not found'}), 404

    if 'name' in filtered:
        name_error = validate_length(filtered['name'], min_length=1, max_length=100)
        if name_error:
            return jsonify({'error': f'Name: {name_error}'}), 400

        if any(c.get('name') == filtered['name'] and c['id'] != cluster_id and c.get('status') != 'deleted' for c in clusters):
            return jsonify({'error': 'Cluster name already exists'}), 400

    cluster.update(filtered)
    save_data('clusters.json', clusters)

    return jsonify(cluster), 200


@bp.route('/<int:cluster_id>', methods=['DELETE'])
@jwt_required()
@require_write
def delete_cluster(cluster_id):
    clusters = load_data('clusters.json')
    cluster = next((c for c in clusters if c['id'] == cluster_id), None)
    if not cluster or cluster.get('status') == 'deleted':
        return jsonify({'error': 'Cluster not found'}), 404

    cluster['status'] = 'deleted'
    save_data('clusters.json', clusters)

    return jsonify({'message': 'Cluster deleted successfully'}), 200


@bp.route('/<int:cluster_id>/related', methods=['GET'])
@jwt_required()
@require_write
def get_cluster_related(cluster_id):
    clusters = load_data('clusters.json')
    cluster = next((c for c in clusters if c['id'] == cluster_id), None)
    if not cluster or cluster.get('status') == 'deleted':
        return jsonify({'error': 'Cluster not found'}), 404

    instances = load_data('instances.json')
    databases = load_data('databases.json')
    db_users = load_data('db_users.json')

    cluster_instances = [i for i in instances if i.get('cluster_id') == cluster_id and i.get('status') != 'deleted']
    instance_ids = [i['id'] for i in cluster_instances]

    related_databases = [d for d in databases if d.get('instance_id') in instance_ids and d.get('status') != 'deleted']
    related_users = [u for u in db_users if u.get('instance_id') in instance_ids and u.get('status') != 'deleted']

    return jsonify({
        'instances': cluster_instances,
        'databases': related_databases,
        'users': related_users
    }), 200
