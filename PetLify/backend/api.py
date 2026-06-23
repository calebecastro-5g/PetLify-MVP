from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from models import (
    User,
    Store,
    Pet,
    VaccineRecord,
    Appointment,
    AppointmentStatus,
    Payment,
    PaymentMethod,
    Role,
    AuditLog,
)
from extensions import db
from utils import role_required, tenant_required, audit_log
from auth import normalize_cpf, password_is_valid, slugify
from catalog import catalog_payload, normalize_plan_name, find_catalog_item, catalog_amount

api_bp = Blueprint('api', __name__)


def current_user():
    identity = get_jwt_identity()
    return User.query.filter_by(id=identity['user_id'], store_id=identity['store_id']).first_or_404()


def parse_datetime(value, field_name):
    if isinstance(value, datetime):
        return value
    if not value:
        raise ValueError(f'{field_name} é obrigatório')
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError(f'{field_name} deve estar em formato ISO-8601') from exc


def parse_money(value):
    try:
        return Decimal(str(value)).quantize(Decimal('0.01'))
    except (InvalidOperation, TypeError):
        raise ValueError('Valor inválido')


@api_bp.route('/catalog', methods=['GET'])
def get_catalog():
    """Tabela centralizada da plataforma: os mesmos planos e valores para todos os Pet Shops."""
    return jsonify(catalog_payload())


@api_bp.route('/stores', methods=['GET'])
def list_public_stores():
    """Busca pública de Pet Shops para vincular clientes ao tenant correto no cadastro."""
    search = (request.args.get('search') or '').strip()
    query = Store.query
    if search:
        query = query.filter(or_(Store.name.ilike(f'%{search}%'), Store.tenant_key.ilike(f'%{slugify(search)}%')))
    stores = query.order_by(Store.name.asc()).limit(50).all()
    return jsonify([store.to_public_dict() for store in stores])


@api_bp.route('/me', methods=['GET'])
@jwt_required()
@tenant_required
def get_current_user():
    return jsonify(current_user().to_profile_dict())


@api_bp.route('/me', methods=['PUT'])
@jwt_required()
@tenant_required
def update_current_user():
    user = current_user()
    data = request.get_json() or {}

    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    if not name or not email:
        return jsonify({'error': 'Nome e e-mail são obrigatórios'}), 400

    email_owner = User.query.filter(User.email == email, User.id != user.id).first()
    if email_owner:
        return jsonify({'error': 'E-mail já está em uso'}), 409

    cpf = normalize_cpf(data.get('cpf'))
    if cpf:
        cpf_owner = User.query.filter(User.cpf == cpf, User.id != user.id).first()
        if cpf_owner:
            return jsonify({'error': 'CPF já cadastrado'}), 409

    new_password = data.get('new_password') or ''
    if new_password:
        if not user.verify_password(data.get('current_password') or ''):
            return jsonify({'error': 'Senha atual incorreta'}), 401
        if not password_is_valid(new_password):
            return jsonify({'error': 'Nova senha deve ter 8 a 64 caracteres, com 1 maiúscula e 1 número'}), 400
        user.password = new_password

    user.name = name
    user.email = email
    user.cpf = cpf
    user.phone = (data.get('phone') or '').strip() or None
    user.birth_date = (data.get('birth_date') or '').strip() or None

    if user.role == Role.OWNER:
        if data.get('store_name'):
            user.store.name = data['store_name'].strip()
        if 'store_address' in data:
            user.store.address = (data.get('store_address') or '').strip() or None

    db.session.commit()
    audit_log(user.id, user.store_id, 'UPDATE', 'User', user.id, 'Perfil atualizado pelo usuário')
    return jsonify({'user': user.to_profile_dict()})


@api_bp.route('/me', methods=['DELETE'])
@jwt_required()
@tenant_required
def deactivate_current_user():
    user = current_user()
    store_id = user.store_id

    if user.role == Role.OWNER:
        active_owners = User.query.filter_by(store_id=store_id, role=Role.OWNER, is_active=True).count()
        if active_owners <= 1:
            return jsonify({'error': 'Cadastre ou ative outro dono antes de desativar esta conta.'}), 400

    user.is_active = False
    db.session.commit()
    audit_log(user.id, store_id, 'DEACTIVATE', 'User', user.id, 'Conta desativada pelo próprio usuário')
    return jsonify({'message': 'Conta desativada com sucesso.'})


@api_bp.route('/pets', methods=['GET'])
@jwt_required()
@tenant_required
def list_pets():
    user = current_user()
    search = (request.args.get('search') or '').strip().lower()
    query = Pet.query.filter_by(store_id=user.store_id)

    if user.role == Role.CLIENT:
        query = query.filter_by(owner_id=user.id)
    elif search:
        query = query.join(User, Pet.owner_id == User.id).filter(
            or_(
                Pet.name.ilike(f'%{search}%'),
                User.name.ilike(f'%{search}%'),
                User.cpf.ilike(f'%{search}%'),
            )
        )

    pets = query.order_by(Pet.name.asc()).all()
    return jsonify([pet.to_dict(include_owner=user.role != Role.CLIENT) for pet in pets])


@api_bp.route('/pets', methods=['POST'])
@jwt_required()
@tenant_required
def create_pet():
    user = current_user()
    data = request.get_json() or {}

    if user.role == Role.CLIENT:
        owner_id = user.id
    else:
        owner_id = data.get('owner_id')
        owner = User.query.filter_by(id=owner_id, store_id=user.store_id, role=Role.CLIENT).first()
        if not owner:
            return jsonify({'error': 'Cliente não encontrado para vincular o pet'}), 404

    required = ['name', 'breed', 'size']
    if any(not data.get(field) for field in required):
        return jsonify({'error': 'Dados obrigatórios faltando'}), 400

    species = data.get('species', 'Cão')
    pet = Pet(
        store_id=user.store_id,
        owner_id=owner_id,
        name=data.get('name', '').strip(),
        species=species,
        breed=data.get('breed', '').strip(),
        size=data.get('size', '').strip(),
        age=int(data.get('age') or 0),
        plan=normalize_plan_name(data.get('plan')),
        photo_icon=data.get('photo_icon') or ('🐱' if species == 'Gato' else '🐶'),
    )
    db.session.add(pet)
    db.session.commit()
    audit_log(user.id, user.store_id, 'CREATE', 'Pet', pet.id, 'Pet cadastrado')
    return jsonify(pet.to_dict(include_owner=True)), 201


@api_bp.route('/pets/<int:pet_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_pet(pet_id):
    user = current_user()
    pet = Pet.query.filter_by(id=pet_id, store_id=user.store_id).first_or_404()
    if user.role == Role.CLIENT and pet.owner_id != user.id:
        return jsonify({'error': 'Permissão negada'}), 403

    data = request.get_json() or {}
    pet.name = data.get('name', pet.name)
    pet.species = data.get('species', pet.species)
    pet.breed = data.get('breed', pet.breed)
    pet.size = data.get('size', pet.size)
    pet.age = int(data.get('age', pet.age))
    if 'plan' in data:
        pet.plan = normalize_plan_name(data.get('plan'))
    db.session.commit()
    audit_log(user.id, user.store_id, 'UPDATE', 'Pet', pet.id, 'Dados do pet atualizados')
    return jsonify(pet.to_dict(include_owner=True))


@api_bp.route('/pets/<int:pet_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def delete_pet(pet_id):
    user = current_user()
    pet = Pet.query.filter_by(id=pet_id, store_id=user.store_id).first_or_404()
    if user.role == Role.CLIENT and pet.owner_id != user.id:
        return jsonify({'error': 'Permissão negada'}), 403

    appointments = Appointment.query.filter_by(pet_id=pet.id, store_id=user.store_id).all()
    for appointment in appointments:
        for payment in Payment.query.filter_by(appointment_id=appointment.id).all():
            payment.appointment_id = None
        db.session.delete(appointment)
    for record in VaccineRecord.query.filter_by(pet_id=pet.id).all():
        db.session.delete(record)

    db.session.delete(pet)
    db.session.commit()
    audit_log(user.id, user.store_id, 'DELETE', 'Pet', pet_id, 'Pet excluído')
    return jsonify({'message': 'Pet excluído com sucesso.'})


@api_bp.route('/vaccine-records', methods=['GET'])
@jwt_required()
@tenant_required
def list_vaccine_records():
    user = current_user()
    pet_id = request.args.get('pet_id', type=int)

    query = VaccineRecord.query.join(Pet)
    if user.role == Role.CLIENT:
        query = query.filter(Pet.owner_id == user.id, Pet.store_id == user.store_id)
    else:
        query = query.filter(Pet.store_id == user.store_id)
    if pet_id:
        query = query.filter(VaccineRecord.pet_id == pet_id)

    records = query.order_by(VaccineRecord.applied_at.desc()).all()
    return jsonify([record.to_dict() for record in records])


@api_bp.route('/vaccine-records', methods=['POST'])
@jwt_required()
@tenant_required
@role_required([Role.EMPLOYEE, Role.OWNER])
def create_vaccine_record():
    user = current_user()
    data = request.get_json() or {}
    pet = Pet.query.filter_by(id=data.get('pet_id'), store_id=user.store_id).first()
    if not pet:
        return jsonify({'error': 'Pet não encontrado para esta loja'}), 404

    try:
        applied_at = parse_datetime(data.get('applied_at'), 'Data de aplicação')
        valid_until = parse_datetime(data.get('valid_until'), 'Data de validade') if data.get('valid_until') else None
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    vaccine_name = (data.get('vaccine_name') or '').strip()
    if not vaccine_name:
        return jsonify({'error': 'Nome da vacina é obrigatório'}), 400

    record = VaccineRecord(
        pet_id=pet.id,
        vaccine_name=vaccine_name,
        applied_at=applied_at,
        valid_until=valid_until,
        veterinarian=(data.get('veterinarian') or '').strip() or None,
        lot=(data.get('lot') or '').strip() or None,
        status=data.get('status') or 'Em dia',
        notes=data.get('notes') or '',
    )
    db.session.add(record)
    db.session.commit()
    audit_log(user.id, user.store_id, 'CREATE', 'VaccineRecord', record.id, f'Vacina registrada para {pet.name}')
    return jsonify(record.to_dict()), 201


@api_bp.route('/vaccine-records/<int:record_id>', methods=['PUT'])
@jwt_required()
@tenant_required
@role_required([Role.EMPLOYEE, Role.OWNER])
def update_vaccine_record(record_id):
    user = current_user()
    record = VaccineRecord.query.get_or_404(record_id)
    if record.pet.store_id != user.store_id:
        return jsonify({'error': 'Permissão negada'}), 403

    data = request.get_json() or {}
    try:
        if 'applied_at' in data and data.get('applied_at'):
            record.applied_at = parse_datetime(data['applied_at'], 'Data de aplicação')
        if 'valid_until' in data:
            record.valid_until = parse_datetime(data['valid_until'], 'Data de validade') if data.get('valid_until') else None
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    record.vaccine_name = data.get('vaccine_name', record.vaccine_name)
    record.status = data.get('status', record.status)
    record.veterinarian = data.get('veterinarian', record.veterinarian)
    record.lot = data.get('lot', record.lot)
    record.notes = data.get('notes', record.notes)
    db.session.commit()
    audit_log(user.id, user.store_id, 'UPDATE', 'VaccineRecord', record.id, 'Registro de vacina atualizado')
    return jsonify(record.to_dict())


@api_bp.route('/vaccine-records/<int:record_id>/cancel', methods=['POST'])
@jwt_required()
@tenant_required
@role_required([Role.EMPLOYEE, Role.OWNER])
def cancel_vaccine_record(record_id):
    user = current_user()
    record = VaccineRecord.query.get_or_404(record_id)
    if record.pet.store_id != user.store_id:
        return jsonify({'error': 'Permissão negada'}), 403

    record.status = 'Cancelada'
    db.session.commit()
    audit_log(user.id, user.store_id, 'CANCEL', 'VaccineRecord', record.id, 'Registro de vacina cancelado')
    return jsonify(record.to_dict())


@api_bp.route('/appointments', methods=['GET'])
@jwt_required()
@tenant_required
def list_appointments():
    user = current_user()
    query = Appointment.query.filter_by(store_id=user.store_id)
    if user.role == Role.CLIENT:
        query = query.filter_by(client_id=user.id)
    status = request.args.get('status')
    if status:
        try:
            query = query.filter_by(status=AppointmentStatus(status))
        except ValueError:
            return jsonify({'error': 'Status inválido'}), 400
    appointments = query.order_by(Appointment.scheduled_at.asc()).all()
    return jsonify([appointment.to_dict() for appointment in appointments])


@api_bp.route('/appointments', methods=['POST'])
@jwt_required()
@tenant_required
def create_appointment():
    user = current_user()
    data = request.get_json() or {}

    pet = Pet.query.filter_by(id=data.get('pet_id'), store_id=user.store_id).first()
    if not pet:
        return jsonify({'error': 'Pet não encontrado'}), 404
    if user.role == Role.CLIENT and pet.owner_id != user.id:
        return jsonify({'error': 'Pet não pertence ao usuário logado'}), 403

    try:
        scheduled_at = parse_datetime(data.get('scheduled_at'), 'Data e horário')
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    appointment = Appointment(
        store_id=user.store_id,
        client_id=pet.owner_id if user.role != Role.CLIENT else user.id,
        pet_id=pet.id,
        service=data.get('service') or 'Banho',
        scheduled_at=scheduled_at,
        status=AppointmentStatus.PENDING,
        notes=data.get('notes') or None,
    )
    db.session.add(appointment)
    db.session.commit()
    audit_log(user.id, user.store_id, 'CREATE', 'Appointment', appointment.id, 'Agendamento criado')
    return jsonify(appointment.to_dict()), 201


@api_bp.route('/appointments/<int:appointment_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_appointment(appointment_id):
    user = current_user()
    appointment = Appointment.query.filter_by(id=appointment_id, store_id=user.store_id).first_or_404()
    data = request.get_json() or {}

    if user.role == Role.CLIENT and appointment.client_id != user.id:
        return jsonify({'error': 'Permissão negada'}), 403
    if user.role == Role.CLIENT and data.get('status') and data['status'] not in ('Cancelado',):
        return jsonify({'error': 'Cliente pode apenas cancelar agendamento'}), 403

    if data.get('status'):
        try:
            appointment.status = AppointmentStatus(data['status'])
        except ValueError:
            return jsonify({'error': 'Status inválido'}), 400
    if data.get('scheduled_at'):
        try:
            appointment.scheduled_at = parse_datetime(data['scheduled_at'], 'Data e horário')
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400
    appointment.service = data.get('service', appointment.service)
    appointment.notes = data.get('notes', appointment.notes)
    db.session.commit()
    audit_log(user.id, user.store_id, 'UPDATE', 'Appointment', appointment.id, 'Agendamento atualizado')
    return jsonify(appointment.to_dict())


@api_bp.route('/appointments/<int:appointment_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def delete_appointment(appointment_id):
    user = current_user()
    appointment = Appointment.query.filter_by(id=appointment_id, store_id=user.store_id).first_or_404()
    if user.role == Role.CLIENT and appointment.client_id != user.id:
        return jsonify({'error': 'Permissão negada'}), 403

    for payment in Payment.query.filter_by(appointment_id=appointment.id).all():
        payment.appointment_id = None
    db.session.delete(appointment)
    db.session.commit()
    audit_log(user.id, user.store_id, 'DELETE', 'Appointment', appointment.id, 'Agendamento excluído')
    return jsonify({'message': 'Agendamento excluído com sucesso.'})


@api_bp.route('/payments', methods=['POST'])
@jwt_required()
@tenant_required
def create_payment():
    user = current_user()
    data = request.get_json() or {}

    try:
        method = PaymentMethod(data.get('method'))
    except (ValueError, KeyError):
        return jsonify({'error': 'Forma de pagamento inválida'}), 400

    catalog_item = find_catalog_item(data.get('item_id'), data.get('item_name'))
    if not catalog_item:
        return jsonify({'error': 'Item fora da tabela padrão da plataforma'}), 400

    client_id = data.get('client_id') or user.id
    if user.role == Role.CLIENT:
        client_id = user.id
    client = User.query.filter_by(id=client_id, store_id=user.store_id).first()
    if not client:
        return jsonify({'error': 'Cliente não encontrado'}), 404

    appointment_id = data.get('appointment_id')
    appointment = None
    if appointment_id:
        appointment = Appointment.query.filter_by(id=appointment_id, store_id=user.store_id).first()
        if not appointment:
            return jsonify({'error': 'Agendamento não encontrado para esta loja'}), 404
    elif catalog_item['type'] == 'Serviço avulso':
        return jsonify({'error': 'Serviços avulsos só podem ser pagos durante o agendamento.'}), 400

    pet_id = data.get('pet_id')
    if catalog_item['type'] == 'Plano mensal':
        if not pet_id:
            return jsonify({'error': 'Planos mensais precisam ser vinculados a um pet'}), 400
        pet = Pet.query.filter_by(id=pet_id, store_id=user.store_id).first()
        if not pet or (user.role == Role.CLIENT and pet.owner_id != user.id):
            return jsonify({'error': 'Pet não encontrado para vincular o plano'}), 404
        pet.plan = catalog_item['name']

    payment = Payment(
        store_id=user.store_id,
        appointment_id=appointment_id,
        client_id=client.id,
        method=method,
        amount=catalog_amount(catalog_item),
        item_id=catalog_item['id'],
        item_name=catalog_item['display_name'],
        item_type=catalog_item['type'],
    )

    if method == PaymentMethod.CASH:
        password = data.get('employee_password') or ''
        confirmer = None
        for candidate in User.query.filter(User.store_id == user.store_id, User.role.in_([Role.EMPLOYEE, Role.OWNER]), User.is_active == True).all():
            if candidate.verify_password(password):
                confirmer = candidate
                break
        if not confirmer:
            return jsonify({'error': 'Senha do funcionário inválida para pagamento em dinheiro'}), 401
        payment.confirmed_by_employee_id = confirmer.id
        payment.confirmed_at = datetime.utcnow()
    else:
        payment.confirmed_at = datetime.utcnow()

    db.session.add(payment)
    db.session.commit()
    audit_log(user.id, user.store_id, 'CREATE', 'Payment', payment.id, f'Pagamento registrado via {method.value}')
    return jsonify(payment.to_dict()), 201


@api_bp.route('/payments', methods=['GET'])
@jwt_required()
@tenant_required
def list_payments():
    user = current_user()
    query = Payment.query.filter_by(store_id=user.store_id)
    if user.role == Role.CLIENT:
        query = query.filter_by(client_id=user.id)
    payments = query.order_by(Payment.created_at.desc()).all()
    return jsonify([payment.to_dict() for payment in payments])


@api_bp.route('/employees', methods=['GET'])
@jwt_required()
@tenant_required
@role_required([Role.EMPLOYEE, Role.OWNER])
def list_employees():
    user = current_user()
    employees = User.query.filter_by(store_id=user.store_id, is_active=True).filter(User.role != Role.CLIENT).order_by(User.name.asc()).all()
    return jsonify([emp.to_profile_dict() for emp in employees])


@api_bp.route('/employees', methods=['POST'])
@jwt_required()
@tenant_required
@role_required([Role.OWNER])
def create_employee():
    user = current_user()
    data = request.get_json() or {}
    password = data.get('password') or ''
    if not password_is_valid(password):
        return jsonify({'error': 'Senha deve ter 8 a 64 caracteres, com 1 maiúscula e 1 número'}), 400

    try:
        role = Role(data.get('role'))
        if role == Role.CLIENT:
            raise ValueError()
    except ValueError:
        return jsonify({'error': 'Perfil de equipe inválido'}), 400

    email = (data.get('email') or '').strip().lower()
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'E-mail já está em uso'}), 409

    employee = User(
        store_id=user.store_id,
        role=role,
        name=(data.get('name') or '').strip(),
        email=email,
        phone=(data.get('phone') or '').strip() or None,
        accepted_lgpd=True,
        is_active=True,
    )
    employee.password = password
    db.session.add(employee)
    db.session.commit()
    audit_log(user.id, user.store_id, 'CREATE', 'User', employee.id, 'Colaborador cadastrado pelo dono')
    return jsonify(employee.to_profile_dict()), 201


@api_bp.route('/employees/<int:user_id>', methods=['PUT'])
@jwt_required()
@tenant_required
@role_required([Role.OWNER])
def update_employee(user_id):
    user = current_user()
    employee = User.query.filter_by(id=user_id, store_id=user.store_id).first_or_404()
    data = request.get_json() or {}
    employee.name = data.get('name', employee.name)
    employee.phone = data.get('phone', employee.phone)
    if 'is_active' in data:
        employee.is_active = bool(data['is_active'])
    db.session.commit()
    audit_log(user.id, user.store_id, 'UPDATE', 'User', employee.id, 'Colaborador atualizado')
    return jsonify(employee.to_profile_dict())


@api_bp.route('/clients', methods=['GET'])
@jwt_required()
@tenant_required
@role_required([Role.EMPLOYEE, Role.OWNER])
def list_clients():
    user = current_user()
    clients = User.query.filter_by(store_id=user.store_id, role=Role.CLIENT).order_by(User.name.asc()).all()
    return jsonify([client.to_profile_dict() for client in clients])


@api_bp.route('/notifications', methods=['GET'])
@jwt_required()
@tenant_required
def list_notifications():
    user = current_user()
    if user.role != Role.CLIENT:
        return jsonify([])

    today = datetime.utcnow()
    soon = today + timedelta(days=30)
    notifications = []
    pets = Pet.query.filter_by(owner_id=user.id, store_id=user.store_id).all()
    for pet in pets:
        records = VaccineRecord.query.filter_by(pet_id=pet.id).all()
        if not records:
            notifications.append({
                'id': f'pet-{pet.id}-no-vaccine',
                'title': f'{pet.name} ainda não tem vacinas cadastradas',
                'description': 'Peça ao funcionário para registrar a carteirinha digital.',
                'level': 'info',
            })
            continue
        for record in records:
            if not record.valid_until:
                continue
            if record.valid_until < today:
                notifications.append({
                    'id': f'vac-{record.id}-late',
                    'title': f'{record.vaccine_name} vencida para {pet.name}',
                    'description': 'Agende uma atualização de vacina com o pet shop.',
                    'level': 'danger',
                })
            elif record.valid_until <= soon:
                notifications.append({
                    'id': f'vac-{record.id}-soon',
                    'title': f'{record.vaccine_name} próxima do vencimento',
                    'description': f'{pet.name} precisa de atenção nos próximos dias.',
                    'level': 'warning',
                })
    return jsonify(notifications)


@api_bp.route('/audit-logs', methods=['GET'])
@jwt_required()
@tenant_required
@role_required([Role.OWNER])
def list_audit_logs():
    user = current_user()
    logs = AuditLog.query.filter_by(store_id=user.store_id).order_by(AuditLog.timestamp.desc()).limit(50).all()
    return jsonify([log.to_dict() for log in logs])
