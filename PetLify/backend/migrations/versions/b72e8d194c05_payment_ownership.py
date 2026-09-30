"""Tie payments to the appointment client or subscription pet owner."""
from alembic import op
import sqlalchemy as sa

revision = 'b72e8d194c05'
down_revision = 'a4b62c819f03'
branch_labels = None
depends_on = None


def upgrade():
    checks = [
        ('agendamento', 'SELECT p.id FROM payments p LEFT JOIN appointments a ON a.id=p.appointment_id '
         'WHERE p.appointment_id IS NOT NULL AND (a.id IS NULL OR p.client_id<>a.client_id OR p.store_id<>a.store_id)'),
        ('assinatura', 'SELECT p.id FROM payments p LEFT JOIN subscriptions s ON s.id=p.subscription_id '
         'LEFT JOIN pets pet ON pet.id=s.pet_id WHERE p.subscription_id IS NOT NULL AND '
         '(s.id IS NULL OR pet.id IS NULL OR p.client_id<>pet.owner_id OR p.store_id<>s.store_id OR p.store_id<>pet.store_id)'),
    ]
    for label, query in checks:
        invalid = op.get_bind().execute(sa.text(query)).first()
        if invalid:
            raise RuntimeError(f'Pagamento {invalid[0]} com cliente incompatível com {label}. Corrija antes de migrar.')
    with op.batch_alter_table('appointments') as batch:
        batch.create_unique_constraint('uq_appointments_id_client_store', ['id', 'client_id', 'store_id'])
    with op.batch_alter_table('payments') as batch:
        batch.add_column(sa.Column('pet_id', sa.Integer(), nullable=True))
    op.execute(sa.text('UPDATE payments SET pet_id=(SELECT s.pet_id FROM subscriptions s '
                       'WHERE s.id=payments.subscription_id) WHERE subscription_id IS NOT NULL'))
    with op.batch_alter_table('payments') as batch:
        batch.create_foreign_key('fk_payments_appointment_client', 'appointments',
                                 ['appointment_id', 'client_id', 'store_id'], ['id', 'client_id', 'store_id'])
        batch.create_foreign_key('fk_payments_pet_owner', 'pets',
                                 ['pet_id', 'client_id', 'store_id'], ['id', 'owner_id', 'store_id'])
        batch.create_foreign_key('fk_payments_subscription_pet', 'subscriptions',
                                 ['subscription_id', 'pet_id', 'store_id'], ['id', 'pet_id', 'store_id'])
        batch.create_check_constraint('ck_payments_subscription_pet_required', 'subscription_id IS NULL OR pet_id IS NOT NULL')


def downgrade():
    with op.batch_alter_table('payments') as batch:
        batch.drop_constraint('ck_payments_subscription_pet_required', type_='check')
        batch.drop_constraint('fk_payments_subscription_pet', type_='foreignkey')
        batch.drop_constraint('fk_payments_pet_owner', type_='foreignkey')
        batch.drop_constraint('fk_payments_appointment_client', type_='foreignkey')
        batch.drop_column('pet_id')
    with op.batch_alter_table('appointments') as batch:
        batch.drop_constraint('uq_appointments_id_client_store', type_='unique')
