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
    frequency: 'Banho/tosa 1x a cada 15 dias',
    description: 'Banho/tosa 1x a cada 15 dias — R$ 99,00/mês',
  },
  {
    id: 'plan-premium',
    name: 'Premium',
    displayName: 'Plano Premium',
    type: 'Plano mensal',
    amount: 189,
    frequency: 'Banho/tosa 1x por semana',
    description: 'Banho/tosa 1x por semana — R$ 189,00/mês',
  },
  {
    id: 'plan-premium-plus',
    name: 'Premium Plus',
    displayName: 'Plano Premium Plus',
    type: 'Plano mensal',
    amount: 349,
    frequency: 'Banho/tosa 2x por semana + hidratação + corte de unha + limpeza de ouvido',
    description: 'Banho/tosa 2x por semana + hidratação + corte de unha + limpeza de ouvido — R$ 349,00/mês',
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
