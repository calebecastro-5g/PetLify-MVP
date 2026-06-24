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
from catalog import find_catalog_item, catalog_amount

DEV_PASSWORD = 'Dev@123456'


def get_or_create_store(name, tenant_key, address):
    store = Store.query.filter_by(tenant_key=tenant_key).first()
    if not store:
        store = Store(name=name, tenant_key=tenant_key, address=address)
        db.session.add(store)
        db.session.flush()
    store.name = name
    store.address = address
    return store


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


def add_payment(store, client, item_id, method):
    item = find_catalog_item(item_id=item_id)
    if not item:
        raise RuntimeError(f'Item de catálogo não encontrado: {item_id}')
    exists = Payment.query.filter_by(client_id=client.id, item_id=item['id']).first()
    if not exists:
        db.session.add(Payment(
            store_id=store.id,
            client_id=client.id,
            item_id=item['id'],
            item_name=item['display_name'],
            item_type=item['type'],
            amount=catalog_amount(item),
            method=method,
            confirmed_at=datetime.utcnow(),
        ))


def seed_store_default(now):
    store = get_or_create_store('Petlify Centro', 'default', 'Rua das Patinhas, 100 - Centro')
    owner = get_or_create_user(store, Role.OWNER, 'Dono Petlify Centro', 'dono@petlify.dev', cpf='11122233344', phone='48999990001')
    employee = get_or_create_user(store, Role.EMPLOYEE, 'Funcionário Petlify Centro', 'funcionario@petlify.dev', cpf='22233344455', phone='48999990002')
    client = get_or_create_user(store, Role.CLIENT, 'Cliente Petlify Centro', 'cliente@petlify.dev', cpf='12345678909', phone='48999990003')

    db.session.flush()

    thor = get_or_create_pet(store, client, 'Thor', 'Cão', 'Golden Retriever', 'Grande', 4, 'Premium', '🐶')
    luna = get_or_create_pet(store, client, 'Luna', 'Gato', 'SRD', 'Pequeno', 2, None, '🐱')
    mel = get_or_create_pet(store, client, 'Mel', 'Cão', 'Shih-tzu', 'Pequeno', 6, 'Básico', '🐶')

    add_appointment(store, client, thor, 'Banho', now + timedelta(hours=3), AppointmentStatus.CONFIRMED)
    add_appointment(store, client, luna, 'Tosa', now + timedelta(days=1, hours=2), AppointmentStatus.PENDING)
    add_appointment(store, client, mel, 'Hidratação', now - timedelta(days=1), AppointmentStatus.COMPLETED)
    add_appointment(store, client, thor, 'Corte de unha', now + timedelta(days=7), AppointmentStatus.PENDING)

    add_vaccine(thor, 'Antirrábica', now - timedelta(days=320), now + timedelta(days=45), 'Dra. Marina', 'A vencer')
    add_vaccine(thor, 'Polivalente V10', now - timedelta(days=40), now + timedelta(days=325), 'Dra. Marina')
    add_vaccine(luna, 'Polivalente Felina V4', now - timedelta(days=380), now - timedelta(days=15), 'Dr. Renato', 'Vencida')
    add_vaccine(mel, 'Gripe Canina', now - timedelta(days=30), now + timedelta(days=335), 'Dra. Marina')

    add_payment(store, client, 'plan-premium', PaymentMethod.PIX)
    add_payment(store, client, 'service-bath', PaymentMethod.CREDIT_CARD)
    add_payment(store, client, 'plan-basic', PaymentMethod.CASH)
    return store, owner, employee, client


def seed_store_maria(now):
    store = get_or_create_store('Pet Shop da Maria', 'petshop-da-maria', 'Av. Azul Claro, 250 - Bairro Jardim')
    owner = get_or_create_user(store, Role.OWNER, 'Maria Oliveira', 'dono.maria@petlify.dev', cpf='33344455566', phone='48988880001')
    employee = get_or_create_user(store, Role.EMPLOYEE, 'Atendente Maria', 'funcionario.maria@petlify.dev', cpf='44455566677', phone='48988880002')
    client = get_or_create_user(store, Role.CLIENT, 'Cliente Maria', 'cliente.maria@petlify.dev', cpf='55566677788', phone='48988880003')

    db.session.flush()

    nina = get_or_create_pet(store, client, 'Nina', 'Cão', 'Poodle', 'Pequeno', 3, 'Premium Plus', '🐶')
    mimi = get_or_create_pet(store, client, 'Mimi', 'Gato', 'Persa', 'Pequeno', 5, 'Básico', '🐱')

    add_appointment(store, client, nina, 'Banho', now + timedelta(hours=5), AppointmentStatus.PENDING)
    add_appointment(store, client, mimi, 'Limpeza de ouvido', now + timedelta(days=2), AppointmentStatus.CONFIRMED)
    add_vaccine(nina, 'Antirrábica', now - timedelta(days=70), now + timedelta(days=295), 'Dra. Paula')
    add_vaccine(mimi, 'Leucemia Felina (FeLV)', now - timedelta(days=410), now - timedelta(days=40), 'Dra. Paula', 'Vencida')

    add_payment(store, client, 'plan-premium-plus', PaymentMethod.PIX)
    add_payment(store, client, 'service-ear-cleaning', PaymentMethod.CREDIT_CARD)
    return store, owner, employee, client


def seed():
    db.create_all()
    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)

    default_store, *_ = seed_store_default(now)
    maria_store, *_ = seed_store_maria(now)

    db.session.commit()
    print('Banco Petlify preparado com sucesso.')
    print('Modelo SaaS multi-tenant ativo: cada conta pertence a um Pet Shop.')
    print('Lojas demo:', default_store.tenant_key, '|', maria_store.tenant_key)
    print('Cliente: cliente@petlify.dev | Senha:', DEV_PASSWORD)
    print('Funcionário: funcionario@petlify.dev | Senha:', DEV_PASSWORD)
    print('Dono: dono@petlify.dev | Senha:', DEV_PASSWORD)
    print('Dono loja Maria: dono.maria@petlify.dev | Senha:', DEV_PASSWORD)


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        seed()
