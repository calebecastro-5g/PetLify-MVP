from decimal import Decimal

PLATFORM_PLANS = [
    {
        'id': 'plan-basic',
        'name': 'Básico',
        'display_name': 'Plano Básico',
        'type': 'Plano mensal',
        'amount': 99.00,
        'frequency': '1 banho e 1 tosa por bloco de 15 dias desde a contratação',
        'description': '1 banho e 1 tosa por bloco de 15 dias — R$ 99,00 por ciclo de 30 dias',
    },
    {
        'id': 'plan-premium',
        'name': 'Premium',
        'display_name': 'Plano Premium',
        'type': 'Plano mensal',
        'amount': 189.00,
        'frequency': '1 banho e 1 tosa por bloco de 7 dias desde a contratação, inclusive no bloco final parcial',
        'description': '1 banho e 1 tosa por bloco de 7 dias — R$ 189,00 por ciclo de 30 dias',
    },
    {
        'id': 'plan-premium-plus',
        'name': 'Premium Plus',
        'display_name': 'Plano Premium Plus',
        'type': 'Plano mensal',
        'amount': 349.00,
        'frequency': '2 banhos e 2 tosas por bloco de 7 dias desde a contratação, inclusive no bloco final parcial; hidratação, corte de unha e limpeza de ouvido: 1 de cada por ciclo',
        'description': '2 banhos e 2 tosas por bloco de 7 dias + 1 de cada extra por ciclo — R$ 349,00 por ciclo de 30 dias',
    },
]

PLATFORM_SERVICES = [
    {
        'id': 'service-bath',
        'name': 'Banho',
        'display_name': 'Banho avulso',
        'type': 'Serviço avulso',
        'amount': 60.00,
        'description': 'Serviço avulso de banho — R$ 60,00',
    },
    {
        'id': 'service-grooming',
        'name': 'Tosa',
        'display_name': 'Tosa avulsa',
        'type': 'Serviço avulso',
        'amount': 50.00,
        'description': 'Serviço avulso de tosa — R$ 50,00',
    },
    {
        'id': 'service-hydration',
        'name': 'Hidratação',
        'display_name': 'Hidratação avulsa',
        'type': 'Serviço avulso',
        'amount': 40.00,
        'description': 'Serviço avulso de hidratação — R$ 40,00',
    },
    {
        'id': 'service-nail-cut',
        'name': 'Corte de unha',
        'display_name': 'Corte de unha',
        'type': 'Serviço avulso',
        'amount': 20.00,
        'description': 'Serviço avulso de corte de unha — R$ 20,00',
    },
    {
        'id': 'service-ear-cleaning',
        'name': 'Limpeza de ouvido',
        'display_name': 'Limpeza de ouvido',
        'type': 'Serviço avulso',
        'amount': 20.00,
        'description': 'Serviço avulso de limpeza de ouvido — R$ 20,00',
    },
]

PLAN_ALIASES = {
    'sem plano': None,
    '': None,
    'básico': 'Básico',
    'basico': 'Básico',
    'plano básico': 'Básico',
    'plano basico': 'Básico',
    'premium': 'Premium',
    'plano premium': 'Premium',
    'premium plus': 'Premium Plus',
    'plano premium plus': 'Premium Plus',
    'vip': 'Premium Plus',
    'plano vip': 'Premium Plus',
}


def catalog_payload():
    return {
        'plans': PLATFORM_PLANS,
        'services': PLATFORM_SERVICES,
        'note': 'Valores fixos e padronizados para todos os Pet Shops da plataforma.',
    }


def all_catalog_items():
    return PLATFORM_PLANS + PLATFORM_SERVICES


def normalize_plan_name(value):
    key = (value or '').strip().lower()
    if key in PLAN_ALIASES:
        return PLAN_ALIASES[key]
    valid_names = {plan['name'] for plan in PLATFORM_PLANS}
    if value in valid_names:
        return value
    return None


def find_catalog_item(item_id=None, item_name=None):
    item_id = (item_id or '').strip()
    item_name = (item_name or '').strip().lower()
    for item in all_catalog_items():
        names = {item['name'].lower(), item['display_name'].lower()}
        if item_id and item['id'] == item_id:
            return item
        if item_name and item_name in names:
            return item
    return None


def catalog_amount(item):
    return Decimal(str(item['amount'])).quantize(Decimal('0.01'))
