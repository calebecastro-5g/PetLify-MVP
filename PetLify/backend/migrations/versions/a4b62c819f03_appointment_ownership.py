"""Ensure appointment tutor and subscription belong to its pet.

Revision ID: a4b62c819f03
Revises: 73032ec89a26
"""
from alembic import op
import sqlalchemy as sa

revision = 'a4b62c819f03'
down_revision = '73032ec89a26'
branch_labels = None
depends_on = None


def upgrade():
    checks = [
        ('tutor', 'SELECT a.id FROM appointments a LEFT JOIN pets p ON p.id=a.pet_id '
         'WHERE p.id IS NULL OR a.client_id<>p.owner_id OR a.store_id<>p.store_id'),
        ('assinatura', 'SELECT a.id FROM appointments a LEFT JOIN subscriptions s ON s.id=a.subscription_id '
         'WHERE a.subscription_id IS NOT NULL AND '
         '(s.id IS NULL OR s.pet_id<>a.pet_id OR s.store_id<>a.store_id)'),
    ]
    for label, query in checks:
        invalid = op.get_bind().execute(sa.text(query)).first()
        if invalid:
            raise RuntimeError(f'Agendamento {invalid[0]} com {label} incompatível com o pet. Corrija antes de migrar.')
    with op.batch_alter_table('pets') as batch:
        batch.create_unique_constraint('uq_pets_id_owner_store', ['id', 'owner_id', 'store_id'])
    with op.batch_alter_table('subscriptions') as batch:
        batch.create_unique_constraint('uq_subscriptions_id_pet_store', ['id', 'pet_id', 'store_id'])
    with op.batch_alter_table('appointments') as batch:
        batch.create_foreign_key('fk_appointments_pet_owner', 'pets',
                                ['pet_id', 'client_id', 'store_id'], ['id', 'owner_id', 'store_id'])
        batch.create_foreign_key('fk_appointments_subscription_pet', 'subscriptions',
                                ['subscription_id', 'pet_id', 'store_id'], ['id', 'pet_id', 'store_id'])


def downgrade():
    with op.batch_alter_table('appointments') as batch:
        batch.drop_constraint('fk_appointments_subscription_pet', type_='foreignkey')
        batch.drop_constraint('fk_appointments_pet_owner', type_='foreignkey')
    with op.batch_alter_table('subscriptions') as batch:
        batch.drop_constraint('uq_subscriptions_id_pet_store', type_='unique')
    with op.batch_alter_table('pets') as batch:
        batch.drop_constraint('uq_pets_id_owner_store', type_='unique')
