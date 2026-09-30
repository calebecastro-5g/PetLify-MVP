export type CatalogItem = {
  id: string;
  name: string;
  displayName: string;
  type: 'Plano mensal' | 'Serviço avulso';
  amount: number;
  description: string;
  frequency?: string;
};

export const platformPlans: CatalogItem[] = [
  {
    id: 'plan-basic',
    name: 'Básico',
    displayName: 'Plano Básico',
    type: 'Plano mensal',
    amount: 99,
    frequency: '1 banho e 1 tosa por bloco de 15 dias desde a contratação',
    description: '1 banho e 1 tosa por bloco de 15 dias — R$ 99,00 por ciclo de 30 dias',
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    displayName: 'Plano Premium',
    type: 'Plano mensal',
    amount: 189,
    frequency: '1 banho e 1 tosa por bloco de 7 dias desde a contratação, inclusive no bloco final parcial',
    description: '1 banho e 1 tosa por bloco de 7 dias — R$ 189,00 por ciclo de 30 dias',
  },
  {
    id: 'plan-premium-plus',
    name: 'Premium Plus',
    displayName: 'Plano Premium Plus',
    type: 'Plano mensal',
    amount: 349,
    frequency: '2 banhos e 2 tosas por bloco de 7 dias desde a contratação, inclusive no bloco final parcial; hidratação, corte de unha e limpeza de ouvido: 1 de cada por ciclo',
    description: '2 banhos e 2 tosas por bloco de 7 dias + 1 de cada extra por ciclo — R$ 349,00 por ciclo de 30 dias',
  },
];

export const platformServices: CatalogItem[] = [
  { id: 'service-bath', name: 'Banho', displayName: 'Banho avulso', type: 'Serviço avulso', amount: 60, description: 'Serviço avulso de banho — R$ 60,00' },
  { id: 'service-grooming', name: 'Tosa', displayName: 'Tosa avulsa', type: 'Serviço avulso', amount: 50, description: 'Serviço avulso de tosa — R$ 50,00' },
  { id: 'service-hydration', name: 'Hidratação', displayName: 'Hidratação avulsa', type: 'Serviço avulso', amount: 40, description: 'Serviço avulso de hidratação — R$ 40,00' },
  { id: 'service-nail-cut', name: 'Corte de unha', displayName: 'Corte de unha', type: 'Serviço avulso', amount: 20, description: 'Serviço avulso de corte de unha — R$ 20,00' },
  { id: 'service-ear-cleaning', name: 'Limpeza de ouvido', displayName: 'Limpeza de ouvido', type: 'Serviço avulso', amount: 20, description: 'Serviço avulso de limpeza de ouvido — R$ 20,00' },
];

export const platformCatalog = [...platformPlans, ...platformServices];

export function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
