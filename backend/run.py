from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from app.api import auth, cluster, instance, database, user, dictionary, activity, migration
from app.utils.errors import APIError
import os
from datetime import timedelta

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'frontend', 'dist')

app = Flask(__name__, static_folder=frontend_dist, static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', os.urandom(32).hex())
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', os.urandom(32).hex())
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=8)
app.config['JSON_AS_ASCII'] = False

jwt = JWTManager(app)

CORS(app, resources={r"/api/*": {
    "origins": "*",
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization"],
    "supports_credentials": True,
    "max_age": 3600
}})


@jwt.unauthorized_loader
def unauthorized_callback(callback, msg):
    return jsonify({'error': 'Authentication required', 'message': msg}), 401


@jwt.invalid_token_loader
def invalid_token_callback(msg):
    return jsonify({'error': 'Invalid token', 'message': msg}), 401


@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token expired', 'message': 'Token has expired'}), 401


@app.errorhandler(APIError)
def handle_api_error_handler(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response


@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path and os.path.exists(os.path.join(frontend_dist, path)):
        return send_from_directory(frontend_dist, path)
    return send_from_directory(frontend_dist, 'index.html')


app.register_blueprint(auth.bp, url_prefix='/api/auth')
app.register_blueprint(cluster.bp, url_prefix='/api/cluster')
app.register_blueprint(instance.bp, url_prefix='/api/instance')
app.register_blueprint(database.bp, url_prefix='/api/database')
app.register_blueprint(user.bp, url_prefix='/api/user')
app.register_blueprint(dictionary.bp, url_prefix='/api/dictionary')
app.register_blueprint(activity.bp, url_prefix='/api/activity')
app.register_blueprint(migration.bp, url_prefix='/api/migration')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
