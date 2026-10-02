"""Time rules tested through the API with disposable, migrated databases."""
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

import test_subscriptions as fixtures
from extensions import db
from models import Appointment, Subscription, VaccineRecord
from time_utils import local_to_utc, parse_local_datetime, utc_iso


class TimezoneFlowTests(unittest.TestCase):
    # Reuse the existing migrated fixture, without inheriting/rerunning its tests.
    setUp = fixtures.SubscriptionFlowTests.setUp
    tearDown = fixtures.SubscriptionFlowTests.tearDown
    headers_for = fixtures.SubscriptionFlowTests.headers_for
    buy = fixtures.SubscriptionFlowTests.buy
    schedule = fixtures.SubscriptionFlowTests.schedule

    def buy_at_noon_utc(self):
        with patch('api.utc_now', return_value=datetime(2026, 10, 2, 12)):
            response = self.buy()
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json['confirmed_at'], '2026-10-02T12:00:00Z')
        subscription = Subscription.query.one()
        self.assertEqual(subscription.to_dict()['starts_at'], '2026-10-02T12:00:00Z')
        return subscription

    def test_offsets_denote_same_instant_and_roundtrip_does_not_move_agenda(self):
        for value in ['2026-10-03T09:00', '2026-10-03T09:00:00-03:00',
                      '2026-10-03T12:00:00Z', '2026-10-03T14:00:00+02:00']:
            with self.subTest(value=value):
                self.assertEqual(parse_local_datetime(value, 'Data'), datetime(2026, 10, 3, 9))
        response = self.schedule(billing_type='Serviço avulso', scheduled_at='2026-10-03T12:00:00Z')
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json['scheduled_at'], '2026-10-03T09:00:00-03:00')
        url = f"/api/appointments/{response.json['id']}"
        edited = self.client.put(url, json={'scheduled_at': response.json['scheduled_at']}, headers=self.headers)
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(Appointment.query.one().scheduled_at, datetime(2026, 10, 3, 9))

    def test_subscription_start_inclusive_end_exclusive_in_shop_time(self):
        self.buy_at_noon_utc()
        for value, expected in [('2026-10-02T08:59:59', 400), ('2026-10-02T09:00', 201),
                                ('2026-11-01T09:00', 400)]:
            with self.subTest(value=value):
                self.assertEqual(self.schedule(scheduled_at=value).status_code, expected)

    def test_quota_boundary_and_usage_query_convert_local_times_to_utc(self):
        subscription = self.buy_at_noon_utc()
        self.assertEqual(self.schedule(scheduled_at='2026-10-03T09:00').status_code, 201)
        self.assertEqual(self.schedule(scheduled_at='2026-10-17T08:30').status_code, 409)
        self.assertEqual(self.schedule(scheduled_at='2026-10-17T09:00').status_code, 201)
        url = f'/api/subscriptions/{subscription.id}/usage'
        for at, start in [('2026-10-17T08:59:59', '2026-10-02T12:00:00Z'),
                          ('2026-10-17T09:00', '2026-10-17T12:00:00Z'),
                          ('2026-10-17T12:00:00Z', '2026-10-17T12:00:00Z')]:
            with self.subTest(at=at):
                response = self.client.get(url, query_string={'at': at}, headers=self.headers)
                self.assertEqual(response.status_code, 200, response.json)
                bath = next(item for item in response.json['services'] if item['service'] == 'Banho')
                self.assertEqual((bath['used'], bath['remaining']), (1, 0))
                self.assertEqual(bath['period_starts_at'], start)

    def test_today_slots_use_shop_clock_instead_of_utc_clock(self):
        with patch('time_utils.utc_now', return_value=datetime(2026, 10, 2, 12, 15)):
            response = self.client.get('/api/appointment-slots', query_string={
                'pet_id': self.pet.id, 'date': '2026-10-02'}, headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['timezone'], 'America/Sao_Paulo')
        self.assertEqual(response.json['slots'][0]['value'], '2026-10-02T09:30')

    def test_cancel_deadline_is_exactly_six_elapsed_hours(self):
        response = self.schedule(billing_type='Serviço avulso', scheduled_at='2026-10-03T15:00')
        url = f"/api/appointments/{response.json['id']}"
        with patch('api.utc_now', return_value=datetime(2026, 10, 3, 12, 0, 1)):
            self.assertEqual(self.client.put(url, json={'status': 'Cancelado'}, headers=self.headers).status_code, 400)
        with patch('api.utc_now', return_value=datetime(2026, 10, 3, 12)):
            self.assertEqual(self.client.put(url, json={'status': 'Cancelado'}, headers=self.headers).status_code, 200)

    def test_delete_deadline_also_converts_agenda_to_utc(self):
        response = self.schedule(billing_type='Serviço avulso', scheduled_at='2026-10-03T15:00')
        url = f"/api/appointments/{response.json['id']}"
        with patch('api.utc_now', return_value=datetime(2026, 10, 3, 12, 0, 1)):
            self.assertEqual(self.client.delete(url, headers=self.headers).status_code, 400)
        with patch('api.utc_now', return_value=datetime(2026, 10, 3, 12)):
            self.assertEqual(self.client.delete(url, headers=self.headers).status_code, 200)

    def test_vaccine_offsets_and_notifications_respect_shop_clock(self):
        from models import Role
        self.user.role = Role.EMPLOYEE
        db.session.commit()
        employee_headers = self.headers_for(self.user)
        response = self.client.post('/api/vaccine-records', json={
            'pet_id': self.pet.id, 'vaccine_name': 'Antirrábica',
            'applied_at': '2026-10-01T12:00:00Z', 'valid_until': '2026-10-02T10:00'}, headers=employee_headers)
        self.assertEqual(response.status_code, 201, response.json)
        self.assertEqual(response.json['applied_at'], '2026-10-01T09:00:00-03:00')
        url = f"/api/vaccine-records/{response.json['id']}"
        edited = self.client.put(url, json={'applied_at': '2026-10-01T09:00'}, headers=employee_headers)
        self.assertEqual(edited.json['applied_at'], response.json['applied_at'])
        self.user.role = Role.CLIENT
        db.session.commit()
        with patch('time_utils.utc_now', return_value=datetime(2026, 10, 2, 12)):
            notifications = self.client.get('/api/notifications', headers=self.headers).json
        self.assertEqual(notifications[0]['level'], 'warning')  # Still valid at 09h local.

    def test_serializing_legacy_naive_values_does_not_rewrite_database(self):
        subscription = self.buy_at_noon_utc()
        appointment = Appointment(store_id=self.user.store_id, client_id=self.user.id,
            pet_id=self.pet.id, service='Banho', scheduled_at=datetime(2026, 10, 3, 9))
        vaccine = VaccineRecord(pet_id=self.pet.id, vaccine_name='Legado', applied_at=datetime(2026, 10, 1, 8))
        db.session.add_all([appointment, vaccine])
        db.session.commit()
        self.assertEqual(appointment.to_dict()['scheduled_at'], '2026-10-03T09:00:00-03:00')
        self.assertEqual(vaccine.to_dict()['applied_at'], '2026-10-01T08:00:00-03:00')
        self.assertEqual(utc_iso(local_to_utc(appointment.scheduled_at)), '2026-10-03T12:00:00Z')
        db.session.expire_all()
        self.assertEqual(appointment.scheduled_at, datetime(2026, 10, 3, 9))
        self.assertEqual(vaccine.applied_at, datetime(2026, 10, 1, 8))
        self.assertEqual(subscription.starts_at, datetime(2026, 10, 2, 12))


if __name__ == '__main__':
    unittest.main()
