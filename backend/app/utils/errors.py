from flask import jsonify

class APIError(Exception):
    def __init__(self, message, status_code=400, payload=None):
        super().__init__()
        self.message = message
        self.status_code = status_code
        self.payload = payload

    def to_dict(self):
        rv = dict(self.payload or ())
        rv['error'] = self.message
        rv['status_code'] = self.status_code
        return rv

class ValidationError(APIError):
    def __init__(self, message, payload=None):
        super().__init__(message, 400, payload)

class NotFoundError(APIError):
    def __init__(self, message='Resource not found'):
        super().__init__(message, 404)

class ConflictError(APIError):
    def __init__(self, message='Resource already exists'):
        super().__init__(message, 409)

class UnauthorizedError(APIError):
    def __init__(self, message='Unauthorized'):
        super().__init__(message, 401)

def handle_api_error(error):
    response = jsonify(error.to_dict())
    response.status_code = error.status_code
    return response
