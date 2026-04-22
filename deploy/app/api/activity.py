from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.utils.storage import load_data, save_data, get_next_id
from app.utils.auth import get_current_user, require_write
from datetime import datetime

bp = Blueprint('activity', __name__)


def log_activity(action, target_type, target_name, details=None, operator=None):
    current_user = operator or get_current_user()
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
def get_activities():
    limit = request.args.get('limit', 20, type=int)
    activities = load_data('activities.json')
    return jsonify(activities[:limit]), 200
