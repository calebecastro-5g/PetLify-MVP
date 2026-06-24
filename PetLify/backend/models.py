from datetime import datetime
from enum import Enum
from sqlalchemy.ext.hybrid import hybrid_property
from extensions import db, bcrypt


class Role(Enum):
    CLIENT = 'cliente'
    EMPLOYEE = 'funcionario'
    OWNER = 'dono'


class AppointmentStatus(Enum):
    PENDING = 'Pendente'
    CONFIRMED = 'Confirmado'
    COMPLETED = 'Concluído'
    CANCELED = 'Cancelado'
    NO_SHOW = 'Falta'


class PaymentMethod(Enum):
    PIX = 'PIX'
    CREDIT_CARD = 'Cartão de Crédito'
    CASH = 'Dinheiro'


class Store(db.Model):
    __tablename__ = 'stores'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    tenant_key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    address = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    users = db.relationship('User', backref='store', lazy=True)
    pets = db.relationship('Pet', backref='store', lazy=True)
    appointments = db.relationship('Appointment', backref='store', lazy=True)
    payments = db.relationship('Payment', backref='store', lazy=True)

    def to_public_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'tenant_key': self.tenant_key,
            'address': self.address,
            'invite_path': f'/cadastro/{self.tenant_key}',
        }


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    role = db.Column(db.Enum(Role), nullable=False, default=Role.CLIENT)
    name = db.Column(db.String(128), nullable=False)
    email = db.Column(db.String(128), unique=True, nullable=False, index=True)
    cpf = db.Column(db.String(14), unique=True, nullable=True, index=True)
    phone = db.Column(db.String(32), nullable=True)
    birth_date = db.Column(db.String(16), nullable=True)
    _password = db.Column('password', db.String(128), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    accepted_lgpd = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    pets = db.relationship('Pet', backref='owner', lazy=True)
    appointments = db.relationship('Appointment', backref='client', lazy=True)

    @hybrid_property
    def password(self):
        return self._password

    @password.setter
    def password(self, plaintext):
        self._password = bcrypt.generate_password_hash(plaintext).decode('utf-8')

    def verify_password(self, plaintext):
        return bcrypt.check_password_hash(self._password, plaintext or '')

    def to_profile_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'cpf': self.cpf,
            'phone': self.phone,
            'birth_date': self.birth_date,
            'role': self.role.value,
            'accepted_lgpd': self.accepted_lgpd,
            'is_active': self.is_active,
            'store_name': self.store.name if self.store else None,
            'store_key': self.store.tenant_key if self.store else None,
            'store_address': self.store.address if self.store else None,
            'invite_path': f'/cadastro/{self.store.tenant_key}' if self.store else None,
        }


class Pet(db.Model):
    __tablename__ = 'pets'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(128), nullable=False)
    species = db.Column(db.String(32), nullable=False, default='Cão')
    breed = db.Column(db.String(64), nullable=False)
    size = db.Column(db.String(32), nullable=False)
    age = db.Column(db.Integer, nullable=False, default=0)
    plan = db.Column(db.String(64), nullable=True)
    photo_icon = db.Column(db.String(16), nullable=False, default='🐾')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    vaccine_records = db.relationship('VaccineRecord', backref='pet', lazy=True)

    def to_dict(self, include_owner=False):
        data = {
            'id': self.id,
            'owner_id': self.owner_id,
            'name': self.name,
            'species': self.species,
            'breed': self.breed,
            'size': self.size,
            'age': self.age,
            'plan': self.plan,
            'photo_icon': self.photo_icon,
        }
        if include_owner:
            data.update({
                'owner_name': self.owner.name if self.owner else 'Tutor',
                'owner_email': self.owner.email if self.owner else None,
                'owner_cpf': self.owner.cpf if self.owner else None,
                'owner_phone': self.owner.phone if self.owner else None,
            })
        return data


class VaccineRecord(db.Model):
    __tablename__ = 'vaccine_records'

    id = db.Column(db.Integer, primary_key=True)
    pet_id = db.Column(db.Integer, db.ForeignKey('pets.id'), nullable=False, index=True)
    vaccine_name = db.Column(db.String(128), nullable=False)
    applied_at = db.Column(db.DateTime, nullable=False)
    valid_until = db.Column(db.DateTime, nullable=True)
    veterinarian = db.Column(db.String(128), nullable=True)
    lot = db.Column(db.String(64), nullable=True)
    status = db.Column(db.String(64), nullable=False, default='Em dia')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'pet_id': self.pet_id,
            'pet_name': self.pet.name if self.pet else 'Pet',
            'vaccine_name': self.vaccine_name,
            'applied_at': self.applied_at.isoformat(),
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'veterinarian': self.veterinarian,
            'lot': self.lot,
            'status': self.status,
            'notes': self.notes,
        }


class Appointment(db.Model):
    __tablename__ = 'appointments'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    client_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    pet_id = db.Column(db.Integer, db.ForeignKey('pets.id'), nullable=False, index=True)
    service = db.Column(db.String(128), nullable=False)
    scheduled_at = db.Column(db.DateTime, nullable=False, index=True)
    status = db.Column(db.Enum(AppointmentStatus), default=AppointmentStatus.PENDING)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    pet = db.relationship('Pet', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'client_name': self.client.name if self.client else 'Cliente',
            'pet_id': self.pet_id,
            'pet_name': self.pet.name if self.pet else 'Pet',
            'pet_species': self.pet.species if self.pet else None,
            'service': self.service,
            'scheduled_at': self.scheduled_at.isoformat(),
            'status': self.status.value,
            'notes': self.notes,
        }


class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    method = db.Column(db.Enum(PaymentMethod), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    item_id = db.Column(db.String(64), nullable=True)
    item_name = db.Column(db.String(128), nullable=True)
    item_type = db.Column(db.String(64), nullable=True)
    confirmed_by_employee_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    confirmed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship('User', foreign_keys=[client_id], lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'client_id': self.client_id,
            'client_name': self.client.name if self.client else 'Cliente',
            'method': self.method.value,
            'amount': float(self.amount),
            'item_id': self.item_id,
            'item_name': self.item_name,
            'item_type': self.item_type,
            'confirmed_by_employee_id': self.confirmed_by_employee_id,
            'confirmed_at': self.confirmed_at.isoformat() if self.confirmed_at else None,
            'created_at': self.created_at.isoformat(),
        }


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, nullable=False)
    action = db.Column(db.String(256), nullable=False)
    entity_type = db.Column(db.String(128), nullable=False)
    entity_id = db.Column(db.Integer, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    details = db.Column(db.Text)

    def to_dict(self):
        return {
            'id': self.id,
            'store_id': self.store_id,
            'user_id': self.user_id,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'timestamp': self.timestamp.isoformat(),
            'details': self.details,
        }
