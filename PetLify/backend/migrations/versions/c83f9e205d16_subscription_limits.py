"""Snapshot separate service quotas for each subscription."""
from alembic import op
import sqlalchemy as sa

revision = 'c83f9e205d16'
down_revision = 'b72e8d194c05'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plan_benefits') as batch:
        batch.add_column(sa.Column('max_uses', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('period_days', sa.Integer(), nullable=True))
    # Freeze this migration's catalogue, independently of application constants.
    op.execute(sa.text("UPDATE plan_benefits SET max_uses=CASE WHEN plan_id='plan-premium-plus' "
                       "AND service_id IN ('service-bath','service-grooming') THEN 2 ELSE 1 END, "
                       "period_days=CASE WHEN plan_id='plan-basic' THEN 15 "
                       "WHEN service_id IN ('service-bath','service-grooming') THEN 7 ELSE 30 END"))
    with op.batch_alter_table('plan_benefits') as batch:
        batch.alter_column('max_uses', existing_type=sa.Integer(), nullable=False)
        batch.alter_column('period_days', existing_type=sa.Integer(), nullable=False)
        batch.create_check_constraint('ck_benefit_max_uses', 'max_uses > 0')
        batch.create_check_constraint('ck_benefit_period', 'period_days > 0')
    op.create_table('subscription_limits',
        sa.Column('subscription_id', sa.Integer(), sa.ForeignKey('subscriptions.id'), primary_key=True),
        sa.Column('service_id', sa.String(64), sa.ForeignKey('services.id'), primary_key=True),
        sa.Column('max_uses', sa.Integer(), nullable=False),
        sa.Column('period_days', sa.Integer(), nullable=False),
        sa.CheckConstraint('max_uses > 0', name='ck_subscription_limit_max'),
        sa.CheckConstraint('period_days > 0', name='ck_subscription_limit_period'))
    op.execute(sa.text('INSERT INTO subscription_limits (subscription_id, service_id, max_uses, period_days) '
                       'SELECT s.id, b.service_id, b.max_uses, b.period_days '
                       'FROM subscriptions s JOIN plan_benefits b ON b.plan_id=s.plan_id'))


def downgrade():
    op.drop_table('subscription_limits')
    with op.batch_alter_table('plan_benefits') as batch:
        batch.drop_constraint('ck_benefit_max_uses', type_='check')
        batch.drop_constraint('ck_benefit_period', type_='check')
        batch.drop_column('period_days')
        batch.drop_column('max_uses')
