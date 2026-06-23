from flask import request
from models import AuditLog
from extensions import db
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

AUDIT_PATHS = ('/api/vaccine-records', '/api/payments', '/api/appointments')


def log_audit(user_id, store_id, action, entity_type, entity_id, details=None):
    audit_entry = AuditLog(
        user_id=user_id,
        store_id=store_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or request.get_json(silent=True) and str(request.get_json())
    )
    db.session.add(audit_entry)
    db.session.commit()


def register_audit_hooks(app):
    @app.after_request
    def audit_response(response):
        if request.path.startswith('/api/') and request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            try:
                verify_jwt_in_request(optional=True)
                identity = get_jwt_identity()
                if identity and request.path.startswith(AUDIT_PATHS):
                    audit_entry = AuditLog(
                        user_id=identity['user_id'],
                        store_id=identity['store_id'],
                        action=f'{request.method} {request.path}',
                        entity_type='AuditMiddleware',
                        entity_id=None,
                        details=f'Status {response.status_code}'
                    )
                    db.session.add(audit_entry)
                    db.session.commit()
            except Exception:
                db.session.rollback()
                pass
        return response
