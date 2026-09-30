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

    pets = db.relationship('Pet', backref='owner', lazy=True, foreign_keys='Pet.owner_id')
    appointments = db.relationship('Appointment', backref='client', lazy=True, foreign_keys='Appointment.client_id')
    __table_args__ = (db.UniqueConstraint('id', 'store_id', name='uq_users_id_store'),)

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
    subscriptions = db.relationship('Subscription', backref='pet', lazy=True, cascade='all, delete-orphan', foreign_keys='Subscription.pet_id')
    __table_args__ = (
        db.UniqueConstraint('id', 'store_id', name='uq_pets_id_store'),
        db.UniqueConstraint('id', 'owner_id', 'store_id', name='uq_pets_id_owner_store'),
        db.ForeignKeyConstraint(['owner_id', 'store_id'], ['users.id', 'users.store_id'], name='fk_pets_owner_store'),
    )

    def subscription_at(self, moment=None):
        moment = moment or datetime.utcnow()
        return Subscription.query.filter(
            Subscription.pet_id == self.id,
            Subscription.store_id == self.store_id,
            Subscription.status == 'active',
            Subscription.starts_at <= moment,
            Subscription.ends_at > moment,
        ).order_by(Subscription.starts_at.desc(), Subscription.id.desc()).first()

    def to_dict(self, include_owner=False):
        subscription = self.subscription_at()
        data = {
            'id': self.id,
            'owner_id': self.owner_id,
            'name': self.name,
            'species': self.species,
            'breed': self.breed,
            'size': self.size,
            'age': self.age,
            'plan': subscription.plan.name if subscription else None,
            'subscription': subscription.to_dict() if subscription else None,
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
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id'), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    pet = db.relationship('Pet', lazy=True, foreign_keys=[pet_id])
    subscription = db.relationship('Subscription', lazy=True, foreign_keys=[subscription_id])
    __table_args__ = (
        db.UniqueConstraint('id', 'store_id', name='uq_appointments_id_store'),
        db.UniqueConstraint('id', 'client_id', 'store_id', name='uq_appointments_id_client_store'),
        db.ForeignKeyConstraint(['pet_id', 'client_id', 'store_id'], ['pets.id', 'pets.owner_id', 'pets.store_id'], name='fk_appointments_pet_owner'),
        db.ForeignKeyConstraint(['subscription_id', 'pet_id', 'store_id'], ['subscriptions.id', 'subscriptions.pet_id', 'subscriptions.store_id'], name='fk_appointments_subscription_pet'),
        db.ForeignKeyConstraint(['client_id', 'store_id'], ['users.id', 'users.store_id'], name='fk_appointments_client_store'),
        db.ForeignKeyConstraint(['pet_id', 'store_id'], ['pets.id', 'pets.store_id'], name='fk_appointments_pet_store'),
        db.ForeignKeyConstraint(['subscription_id', 'store_id'], ['subscriptions.id', 'subscriptions.store_id'], name='fk_appointments_subscription_store'),
    )

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
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id'), nullable=True, index=True)
    client_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    pet_id = db.Column(db.Integer, nullable=True)
    method = db.Column(db.Enum(PaymentMethod), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    item_id = db.Column(db.String(64), nullable=True)
    item_name = db.Column(db.String(128), nullable=True)
    item_type = db.Column(db.String(64), nullable=True)
    confirmed_by_employee_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    confirmed_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship('User', foreign_keys=[client_id], lazy=True)
    __table_args__ = (
        db.ForeignKeyConstraint(['appointment_id', 'client_id', 'store_id'], ['appointments.id', 'appointments.client_id', 'appointments.store_id'], name='fk_payments_appointment_client'),
        db.ForeignKeyConstraint(['pet_id', 'client_id', 'store_id'], ['pets.id', 'pets.owner_id', 'pets.store_id'], name='fk_payments_pet_owner'),
        db.ForeignKeyConstraint(['subscription_id', 'pet_id', 'store_id'], ['subscriptions.id', 'subscriptions.pet_id', 'subscriptions.store_id'], name='fk_payments_subscription_pet'),
        db.CheckConstraint('subscription_id IS NULL OR pet_id IS NOT NULL', name='ck_payments_subscription_pet_required'),
        db.ForeignKeyConstraint(['client_id', 'store_id'], ['users.id', 'users.store_id'], name='fk_payments_client_store'),
        db.ForeignKeyConstraint(['confirmed_by_employee_id', 'store_id'], ['users.id', 'users.store_id'], name='fk_payments_confirmer_store'),
        db.ForeignKeyConstraint(['appointment_id', 'store_id'], ['appointments.id', 'appointments.store_id'], name='fk_payments_appointment_store'),
        db.ForeignKeyConstraint(['subscription_id', 'store_id'], ['subscriptions.id', 'subscriptions.store_id'], name='fk_payments_subscription_store'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'subscription_id': self.subscription_id,
            'pet_id': self.pet_id,
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


class Plan(db.Model):
    __tablename__ = 'plans'

    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(64), nullable=False, unique=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    duration_days = db.Column(db.Integer, nullable=False, default=30)
    benefits = db.relationship('PlanBenefit', lazy=True, cascade='all, delete-orphan')
    __table_args__ = (
        db.CheckConstraint('amount >= 0', name='ck_plan_amount'),
        db.CheckConstraint('duration_days > 0', name='ck_plan_duration'),
    )

    def covers(self, service):
        return any(benefit.service.name == service for benefit in self.benefits)


class Service(db.Model):
    __tablename__ = 'services'

    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(128), nullable=False, unique=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    __table_args__ = (db.CheckConstraint('amount >= 0', name='ck_service_amount'),)


class PlanBenefit(db.Model):
    __tablename__ = 'plan_benefits'

    plan_id = db.Column(db.String(64), db.ForeignKey('plans.id'), primary_key=True)
    service_id = db.Column(db.String(64), db.ForeignKey('services.id'), primary_key=True)
    max_uses = db.Column(db.Integer, nullable=False)
    period_days = db.Column(db.Integer, nullable=False)
    service = db.relationship('Service', lazy=True)
    __table_args__ = (
        db.CheckConstraint('max_uses > 0', name='ck_benefit_max_uses'),
        db.CheckConstraint('period_days > 0', name='ck_benefit_period'),
    )


class SubscriptionLimit(db.Model):
    __tablename__ = 'subscription_limits'

    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id'), primary_key=True)
    service_id = db.Column(db.String(64), db.ForeignKey('services.id'), primary_key=True)
    max_uses = db.Column(db.Integer, nullable=False)
    period_days = db.Column(db.Integer, nullable=False)
    service = db.relationship('Service', lazy=True)
    __table_args__ = (
        db.CheckConstraint('max_uses > 0', name='ck_subscription_limit_max'),
        db.CheckConstraint('period_days > 0', name='ck_subscription_limit_period'),
    )


class Subscription(db.Model):
    __tablename__ = 'subscriptions'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    pet_id = db.Column(db.Integer, db.ForeignKey('pets.id'), nullable=False, index=True)
    plan_id = db.Column(db.String(64), db.ForeignKey('plans.id'), nullable=False)
    starts_at = db.Column(db.DateTime, nullable=False)
    ends_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(16), nullable=False, default='active')
    source = db.Column(db.String(16), nullable=False, default='purchase')
    plan = db.relationship('Plan', lazy=True)
    limits = db.relationship('SubscriptionLimit', lazy=True, cascade='all, delete-orphan')

    def capture_limits(self):
        self.limits = [SubscriptionLimit(service_id=benefit.service_id,
                      max_uses=benefit.max_uses, period_days=benefit.period_days)
                       for benefit in self.plan.benefits]

    def covers(self, service):
        return any(limit.service.name == service for limit in self.limits)
    __table_args__ = (
        db.UniqueConstraint('id', 'store_id', name='uq_subscriptions_id_store'),
        db.UniqueConstraint('id', 'pet_id', 'store_id', name='uq_subscriptions_id_pet_store'),
        db.ForeignKeyConstraint(['pet_id', 'store_id'], ['pets.id', 'pets.store_id'], name='fk_subscriptions_pet_store'),
        db.CheckConstraint('ends_at > starts_at', name='ck_subscription_period'),
        db.CheckConstraint("status IN ('active', 'replaced', 'canceled')", name='ck_subscription_status'),
        db.CheckConstraint("source IN ('purchase', 'legacy', 'demo')", name='ck_subscription_source'),
    )

    def to_dict(self):
        now = datetime.utcnow()
        return {
            'id': self.id, 'pet_id': self.pet_id, 'plan_id': self.plan_id,
            'plan_name': self.plan.name,
            'starts_at': self.starts_at.isoformat(), 'ends_at': self.ends_at.isoformat(),
            'status': 'expired' if self.status == 'active' and now >= self.ends_at else self.status,
            'source': self.source,
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
