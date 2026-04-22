from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.validators import validate_required, validate_length
from app.utils.auth import require_admin, require_write, filter_fields

bp = Blueprint('dictionary', __name__)


@bp.route('/groups', methods=['GET'])
@jwt_required()
def get_groups():
    groups = load_data('groups.json')
    return jsonify(groups), 200


@bp.route('/groups', methods=['POST'])
@jwt_required()
@require_admin
def create_group():
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    if 'name' not in data or not data.get('name'):
        return jsonify({'error': 'Missing required field: name'}), 400

    name = data['name'].strip()
    if not name:
        return jsonify({'error': 'Name cannot be empty'}), 400

    if len(name) > 50:
        return jsonify({'error': 'Name: Maximum length is 50'}), 400

    groups = load_data('groups.json')

    new_code = f"GROUP{len(groups) + 1:03d}"

    new_group = {
        'id': get_next_id(groups),
        'name': name,
        'code': new_code,
        'type': 'group'
    }

    groups.append(new_group)
    save_data('groups.json', groups)

    return jsonify(new_group), 201


@bp.route('/groups/<int:group_id>', methods=['PUT'])
@jwt_required()
@require_admin
def update_group(group_id):
    data = request.json
    filtered = filter_fields('groups', data)

    groups = load_data('groups.json')
    group = next((g for g in groups if g['id'] == group_id), None)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    if 'name' in filtered:
        name_error = validate_length(filtered['name'], min_length=1, max_length=50)
        if name_error:
            return jsonify({'error': f'Name: {name_error}'}), 400

    group.update(filtered)
    save_data('groups.json', groups)

    return jsonify(group), 200


@bp.route('/groups/<int:group_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_group(group_id):
    groups = load_data('groups.json')
    group = next((g for g in groups if g['id'] == group_id), None)
    if not group:
        return jsonify({'error': 'Group not found'}), 404

    groups = [g for g in groups if g['id'] != group_id]
    save_data('groups.json', groups)

    return jsonify({'message': 'Group deleted successfully'}), 200


@bp.route('/staff', methods=['GET'])
@jwt_required()
def get_staff():
    staff = load_data('staff.json')
    groups = load_data('groups.json')

    group_map = {g['id']: g['name'] for g in groups}

    for s in staff:
        if s.get('group_id'):
            s['group_name'] = group_map.get(s['group_id'], '')

    return jsonify(staff), 200


@bp.route('/staff', methods=['POST'])
@jwt_required()
@require_admin
def create_staff():
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    if 'name' not in data or not data.get('name'):
        return jsonify({'error': 'Missing required field: name'}), 400

    if 'group_id' not in data or not data.get('group_id'):
        return jsonify({'error': 'Missing required field: group_id'}), 400

    name = data['name'].strip()
    if not name:
        return jsonify({'error': 'Name cannot be empty'}), 400

    if len(name) > 50:
        return jsonify({'error': 'Name: Maximum length is 50'}), 400

    groups = load_data('groups.json')
    if not any(g['id'] == data['group_id'] for g in groups):
        return jsonify({'error': 'Group not found'}), 404

    staff = load_data('staff.json')

    new_code = f"EMP{len(staff) + 1:03d}"

    new_staff = {
        'id': get_next_id(staff),
        'name': name,
        'code': new_code,
        'group_id': data['group_id'],
        'type': 'staff'
    }

    staff.append(new_staff)
    save_data('staff.json', staff)

    return jsonify(new_staff), 201


@bp.route('/staff/<int:staff_id>', methods=['PUT'])
@jwt_required()
@require_admin
def update_staff(staff_id):
    data = request.json
    filtered = filter_fields('staff', data)

    staff = load_data('staff.json')
    member = next((s for s in staff if s['id'] == staff_id), None)
    if not member:
        return jsonify({'error': 'Staff not found'}), 404

    if 'name' in filtered:
        name_error = validate_length(filtered['name'], min_length=1, max_length=50)
        if name_error:
            return jsonify({'error': f'Name: {name_error}'}), 400

    if 'code' in filtered:
        code_error = validate_length(filtered['code'], min_length=1, max_length=20)
        if code_error:
            return jsonify({'error': f'Code: {code_error}'}), 400

        if any(s.get('code') == filtered['code'] and s['id'] != staff_id for s in staff):
            return jsonify({'error': 'Staff code already exists'}), 400

    if 'group_id' in filtered:
        groups = load_data('groups.json')
        if not any(g['id'] == filtered['group_id'] for g in groups):
            return jsonify({'error': 'Group not found'}), 404

    member.update(filtered)
    save_data('staff.json', staff)

    return jsonify(member), 200


@bp.route('/staff/<int:staff_id>', methods=['DELETE'])
@jwt_required()
@require_admin
def delete_staff(staff_id):
    staff = load_data('staff.json')
    member = next((s for s in staff if s['id'] == staff_id), None)
    if not member:
        return jsonify({'error': 'Staff not found'}), 404

    staff = [s for s in staff if s['id'] != staff_id]
    save_data('staff.json', staff)

    return jsonify({'message': 'Staff deleted successfully'}), 200


@bp.route('/apps', methods=['GET'])
@jwt_required()
def get_apps():
    apps = load_data('apps.json')
    staff = load_data('staff.json')

    staff_map = {s['code']: s['name'] for s in staff}

    for app in apps:
        app['developer_name'] = staff_map.get(app.get('developer'), '')
        app['operator_name'] = staff_map.get(app.get('operator'), '')

    return jsonify(apps), 200


@bp.route('/apps', methods=['POST'])
@jwt_required()
@require_write
def create_app():
    data = request.get_json()
    filtered = filter_fields('apps', data)

    if not filtered.get('name'):
        return jsonify({'error': 'Missing required field: name'}), 400

    apps = load_data('apps.json')

    new_app = {
        'id': get_next_id(apps),
        'name': filtered['name'],
        'domain': filtered.get('domain', ''),
        'developer': filtered.get('developer', ''),
        'operator': filtered.get('operator', ''),
        'description': filtered.get('description', '')
    }
    apps.append(new_app)
    save_data('apps.json', apps)

    staff = load_data('staff.json')
    staff_map = {s['code']: s['name'] for s in staff}
    new_app['developer_name'] = staff_map.get(new_app.get('developer'), '')
    new_app['operator_name'] = staff_map.get(new_app.get('operator'), '')

    return jsonify(new_app), 201


@bp.route('/apps/<int:app_id>', methods=['PUT'])
@jwt_required()
@require_write
def update_app(app_id):
    data = request.get_json()
    filtered = filter_fields('apps', data)

    apps = load_data('apps.json')

    app = next((a for a in apps if a['id'] == app_id), None)
    if not app:
        return jsonify({'error': 'App not found'}), 404

    app.update(filtered)
    save_data('apps.json', apps)

    staff = load_data('staff.json')
    staff_map = {s['code']: s['name'] for s in staff}
    app['developer_name'] = staff_map.get(app.get('developer'), '')
    app['operator_name'] = staff_map.get(app.get('operator'), '')

    return jsonify(app), 200


@bp.route('/apps/<int:app_id>', methods=['DELETE'])
@jwt_required()
@require_write
def delete_app(app_id):
    apps = load_data('apps.json')
    app = next((a for a in apps if a['id'] == app_id), None)
    if not app:
        return jsonify({'error': 'App not found'}), 404

    apps = [a for a in apps if a['id'] != app_id]
    save_data('apps.json', apps)
    return jsonify({'message': 'App deleted successfully'}), 200
