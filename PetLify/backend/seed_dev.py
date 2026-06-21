from datetime import datetime, timedelta
from app import create_app
from extensions import db
from models import (
    Store,
    User,
    Pet,
    Appointment,
    AppointmentStatus,
    VaccineRecord,
    Payment,
    PaymentMethod,
    Role,
)

DEV_PASSWORD = 'Dev@123456'


def get_or_create_user(store, role, name, email, cpf=None, phone=None):
    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            store_id=store.id,
            role=role,
            name=name,
            email=email,
            cpf=cpf,
            phone=phone,
            accepted_lgpd=True,
            is_active=True,
        )
        db.session.add(user)
    user.name = name
    user.role = role
    user.store_id = store.id
    user.cpf = cpf
    user.phone = phone
    user.accepted_lgpd = True
    user.is_active = True
    user.password = DEV_PASSWORD
    return user


def get_or_create_pet(store, owner, name, species, breed, size, age, plan, icon):
    pet = Pet.query.filter_by(owner_id=owner.id, name=name).first()
    if not pet:
        pet = Pet(store_id=store.id, owner_id=owner.id, name=name, breed=breed, size=size, age=age)
        db.session.add(pet)
    pet.store_id = store.id
    pet.owner_id = owner.id
    pet.species = species
    pet.breed = breed
    pet.size = size
    pet.age = age
    pet.plan = plan
    pet.photo_icon = icon
    return pet


def add_appointment(store, client, pet, service, date, status):
    exists = Appointment.query.filter_by(pet_id=pet.id, service=service, scheduled_at=date).first()
    if not exists:
        db.session.add(Appointment(
            store_id=store.id,
            client_id=client.id,
            pet_id=pet.id,
            service=service,
            scheduled_at=date,
            status=status,
        ))


def add_vaccine(pet, name, applied_at, valid_until, veterinarian, status='Em dia'):
    exists = VaccineRecord.query.filter_by(pet_id=pet.id, vaccine_name=name, applied_at=applied_at).first()
    if not exists:
        db.session.add(VaccineRecord(
            pet_id=pet.id,
            vaccine_name=name,
            applied_at=applied_at,
            valid_until=valid_until,
            veterinarian=veterinarian,
            lot='DEMO-01',
            status=status,
            notes='Registro de demonstração criado pelo seed_dev.py',
        ))


def add_payment(store, client, item_name, item_type, amount, method):
    exists = Payment.query.filter_by(client_id=client.id, item_name=item_name, amount=amount).first()
    if not exists:
        db.session.add(Payment(
            store_id=store.id,
            client_id=client.id,
            item_name=item_name,
            item_type=item_type,
            amount=amount,
            method=method,
            confirmed_at=datetime.utcnow(),
        ))


def seed():
    db.create_all()

    store = Store.query.filter_by(tenant_key='default').first()
    if not store:
        store = Store(name='Petlify Pet Shop', tenant_key='default')
        db.session.add(store)
        db.session.flush()
    store.name = 'Petlify Pet Shop'

    owner = get_or_create_user(store, Role.OWNER, 'Dono Petlify', 'dono@petlify.dev', phone='48999990001')
    employee = get_or_create_user(store, Role.EMPLOYEE, 'Funcionário Petlify', 'funcionario@petlify.dev', phone='48999990002')
    client = get_or_create_user(store, Role.CLIENT, 'Cliente Petlify', 'cliente@petlify.dev', cpf='12345678909', phone='48999990003')

    db.session.flush()

    thor = get_or_create_pet(store, client, 'Thor', 'Cão', 'Golden Retriever', 'Grande', 4, 'Plano Premium', '🐶')
    luna = get_or_create_pet(store, client, 'Luna', 'Gato', 'SRD', 'Pequeno', 2, 'Sem plano', '🐱')
    mel = get_or_create_pet(store, client, 'Mel', 'Cão', 'Shih-tzu', 'Pequeno', 6, 'Plano Básico', '🐶')

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    add_appointment(store, client, thor, 'Banho e Tosa', now + timedelta(hours=3), AppointmentStatus.CONFIRMED)
    add_appointment(store, client, luna, 'Consulta', now + timedelta(days=1, hours=2), AppointmentStatus.PENDING)
    add_appointment(store, client, mel, 'Banho', now - timedelta(days=1), AppointmentStatus.COMPLETED)
    add_appointment(store, client, thor, 'Vacinação', now + timedelta(days=7), AppointmentStatus.PENDING)

    add_vaccine(thor, 'Antirrábica', now - timedelta(days=320), now + timedelta(days=45), 'Dra. Marina', 'A vencer')
    add_vaccine(thor, 'Polivalente V10', now - timedelta(days=40), now + timedelta(days=325), 'Dra. Marina')
    add_vaccine(luna, 'Polivalente Felina V4', now - timedelta(days=380), now - timedelta(days=15), 'Dr. Renato', 'Vencida')
    add_vaccine(mel, 'Gripe Canina', now - timedelta(days=30), now + timedelta(days=335), 'Dra. Marina')

    add_payment(store, client, 'Plano Premium - Thor', 'Plano mensal', 129.90, PaymentMethod.PIX)
    add_payment(store, client, 'Banho e Tosa - Mel', 'Serviço avulso', 99.90, PaymentMethod.CREDIT_CARD)
    add_payment(store, client, 'Plano Básico - Mel', 'Plano mensal', 79.90, PaymentMethod.CASH)

    db.session.commit()
    print('Banco Petlify preparado com sucesso.')
    print('Cliente: cliente@petlify.dev | Senha:', DEV_PASSWORD)
    print('Funcionário: funcionario@petlify.dev | Senha:', DEV_PASSWORD)
    print('Dono: dono@petlify.dev | Senha:', DEV_PASSWORD)


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        seed()
