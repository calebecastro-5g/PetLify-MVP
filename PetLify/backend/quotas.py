"""Service usage in fixed blocks anchored to a subscription's start."""
from datetime import timedelta
from sqlalchemy import update
from extensions import db
from models import Appointment, AppointmentStatus, Subscription


def lock_subscription(subscription):
    # An UPDATE acquires a write lock also on SQLite (FOR UPDATE does not).
    # Keep it until the appointment transaction commits or rolls back.
    db.session.execute(update(Subscription).where(Subscription.id == subscription.id)
                       .values(status=Subscription.status)
                       .execution_options(synchronize_session=False))
    db.session.refresh(subscription)


def usage_for(subscription, service, moment, ignore_appointment_id=None):
    limit = next((item for item in subscription.limits if item.service.name == service), None)
    if not limit or not subscription.starts_at <= moment < subscription.ends_at:
        return None
    block = (moment - subscription.starts_at) // timedelta(days=limit.period_days)
    start = subscription.starts_at + timedelta(days=block * limit.period_days)
    end = min(start + timedelta(days=limit.period_days), subscription.ends_at)
    query = Appointment.query.filter(
        Appointment.subscription_id == subscription.id,
        Appointment.store_id == subscription.store_id,
        Appointment.pet_id == subscription.pet_id,
        Appointment.service == service,
        Appointment.scheduled_at >= start,
        Appointment.scheduled_at < end,
        Appointment.status != AppointmentStatus.CANCELED,
    )
    if ignore_appointment_id is not None:
        query = query.filter(Appointment.id != ignore_appointment_id)
    used = query.count()
    return {'service': service, 'limit': limit.max_uses, 'used': used,
            'remaining': max(0, limit.max_uses - used),
            'period_starts_at': start.isoformat(), 'period_ends_at': end.isoformat()}


def quota_error(subscription, service, moment, ignore_appointment_id=None):
    usage = usage_for(subscription, service, moment, ignore_appointment_id)
    if usage is None:
        return 'O plano não cobre este serviço na data escolhida.'
    if usage['remaining'] == 0:
        return f"Cota de {service} esgotada neste período (limite: {usage['limit']}). Escolha outro período ou agende como avulso."
    return None
