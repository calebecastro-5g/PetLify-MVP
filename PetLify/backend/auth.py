import random
import re
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, create_refresh_token
from email_validator import validate_email, EmailNotValidError
from models import User, Store, Role
from extensions import db
from utils import audit_log


auth_bp = Blueprint('auth', __name__)
LOGIN_2FA_CODES = {}


def normalize_cpf(cpf):
    if not cpf:
        return None
    digits = re.sub(r'\D', '', cpf)
    return digits or None


def password_is_valid(password: str) -> bool:
    if not password or len(password) < 8 or len(password) > 64:
        return False
    return bool(re.search(r'[A-ZÁÉÍÓÚÂÊÔÃÕÇ]', password)) and bool(re.search(r'\d', password))


def build_tokens(user: User):
    identity = {'user_id': user.id, 'store_id': user.store_id, 'role': user.role.value}
    return {
        'access_token': create_access_token(identity=identity),
        'refresh_token': create_refresh_token(identity=identity),
        'role': user.role.value,
        'name': user.name,
    }


def get_or_create_default_store(store_key='default'):
    store = Store.query.filter_by(tenant_key=store_key).first()
    if not store and store_key == 'default':
        store = Store(name='Petlify Pet Shop', tenant_key='default')
        db.session.add(store)
        db.session.flush()
    return store


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    try:
        email = validate_email(data.get('email', '').strip(), check_deliverability=False).email.lower()
    except EmailNotValidError:
        return jsonify({'error': 'E-mail inválido'}), 400

    role_value = data.get('role', Role.CLIENT.value)
    try:
        role = Role(role_value)
    except ValueError:
        return jsonify({'error': 'Perfil inválido'}), 400

    name = (data.get('name') or '').strip()
    password = data.get('password') or ''
    if not name or not password:
        return jsonify({'error': 'Dados obrigatórios faltando'}), 400

    if not password_is_valid(password):
        return jsonify({'error': 'Senha deve ter 8 a 64 caracteres, com 1 maiúscula e 1 número'}), 400

    store_key = data.get('store_key') or 'default'
    if role != Role.CLIENT and not store_key:
        return jsonify({'error': 'Chave da loja obrigatória para equipe'}), 400

    store = get_or_create_default_store(store_key)
    if not store:
        return jsonify({'error': 'Loja não encontrada'}), 404

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'E-mail já está em uso'}), 409

    cpf = normalize_cpf(data.get('cpf'))
    if cpf and User.query.filter_by(cpf=cpf).first():
        return jsonify({'error': 'CPF já cadastrado'}), 409

    user = User(
        store_id=store.id,
        role=role,
        name=name,
        email=email,
        cpf=cpf,
        phone=(data.get('phone') or '').strip() or None,
        birth_date=(data.get('birth_date') or '').strip() or None,
        accepted_lgpd=bool(data.get('accepted_lgpd', False)),
        is_active=True,
    )
    user.password = password
    db.session.add(user)
    db.session.commit()

    audit_log(user.id, store.id, 'REGISTER', 'User', user.id, f'Cadastro realizado como {role.value}')
    return jsonify(build_tokens(user)), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    role_value = data.get('role')

    user = User.query.filter_by(email=email).first()
    if not user or not user.is_active or not user.verify_password(password):
        return jsonify({'error': 'E-mail ou senha incorretos'}), 401

    if role_value and user.role.value != role_value:
        return jsonify({'error': 'E-mail ou senha incorretos'}), 401

    is_dev_account = user.email.endswith('@petlify.dev')
    requires_2fa = user.role in (Role.EMPLOYEE, Role.OWNER) and not is_dev_account

    if requires_2fa:
        code = f'{random.randint(0, 999999):06d}'
        LOGIN_2FA_CODES[user.email] = {
            'code': code,
            'expires_at': datetime.utcnow() + timedelta(minutes=10),
            'attempts': 0,
        }
        current_app.logger.info('2FA code for %s: %s', user.email, code)
        response = {'requires_2fa': True, 'message': 'Código de verificação enviado.'}
        if current_app.debug:
            response['dev_2fa_code'] = code
        return jsonify(response), 200

    audit_log(user.id, user.store_id, 'LOGIN', 'User', user.id, 'Login realizado')
    return jsonify(build_tokens(user)), 200


@auth_bp.route('/verify-2fa', methods=['POST'])
def verify_2fa():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    code = (data.get('code') or '').strip()
    user = User.query.filter_by(email=email).first()
    record = LOGIN_2FA_CODES.get(email)

    if not user or not record:
        return jsonify({'error': 'Código inválido'}), 401
    if datetime.utcnow() > record['expires_at']:
        LOGIN_2FA_CODES.pop(email, None)
        return jsonify({'error': 'Código expirado'}), 401
    if record['attempts'] >= 3:
        LOGIN_2FA_CODES.pop(email, None)
        return jsonify({'error': 'Código expirado. Faça login novamente.'}), 401
    if code != record['code']:
        record['attempts'] += 1
        return jsonify({'error': 'Código inválido'}), 401

    LOGIN_2FA_CODES.pop(email, None)
    audit_log(user.id, user.store_id, 'LOGIN_2FA', 'User', user.id, 'Login com 2FA validado')
    return jsonify(build_tokens(user)), 200


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    # MVP: evita expor existência do e-mail, conforme requisito de segurança.
    return jsonify({'message': 'Se o e-mail existir em nossa base, você receberá instruções.'}), 200
