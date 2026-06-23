from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from models import Role


def tenant_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        identity = get_jwt_identity()
        if not identity or not identity.get('store_id'):
            return jsonify({'error': 'Tenant inválido'}), 401
        return fn(*args, **kwargs)
    return wrapper


def role_required(roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            if not identity:
                return jsonify({'error': 'Não autenticado'}), 401
            if identity.get('role') not in [role.value for role in roles]:
                return jsonify({'error': 'Permissão negada'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def audit_log(user_id, store_id, action, entity_type, entity_id, details=None):
    from models import AuditLog
    from extensions import db
    entry = AuditLog(
        user_id=user_id,
        store_id=store_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
    )
    db.session.add(entry)
    db.session.commit()
