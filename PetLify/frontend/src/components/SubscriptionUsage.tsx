import { useEffect, useId, useState } from 'react';
import styled from 'styled-components';
import { apiFetch } from '../lib/api';
import { formatDateTime as dateTime, formatShopInput } from '../lib/dates';

export type PetSubscription = {
  id: number;
  plan_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

type ServiceUsage = {
  service: string;
  limit: number;
  used: number;
  remaining: number;
  period_starts_at: string;
  period_ends_at: string;
};
type Usage = { subscription_id: number; status: string; services: ServiceUsage[] };
type Result = { key: string; data?: Usage; error?: string };

export default function SubscriptionUsage({ subscription, petName, at, refreshKey = 0, editing = false }: {
  subscription: PetSubscription;
  petName: string;
  // Shop slot YYYY-MM-DDTHH:mm; undefined = now; null = not selected yet.
  at?: string | null;
  refreshKey?: number;
  editing?: boolean;
}) {
  const headingId = useId();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = JSON.stringify([subscription.id, at, refreshKey, attempt]);

  useEffect(() => {
    if (at === null) return;
    const controller = new AbortController();
    const query = at ? `?${new URLSearchParams({ at })}` : '';
    async function load() {
      try {
        const response = await apiFetch(`/api/subscriptions/${subscription.id}/usage${query}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível consultar o saldo.');
        if (!controller.signal.aborted) setResult({ key, data });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'Não foi possível consultar o saldo.' });
      }
    }
    void load();
    return () => controller.abort();
  }, [subscription.id, at, key]);

  // Never display a previous pet's or period's balance while a new request runs.
  const current = result?.key === key ? result : null;
  return (
    <Panel aria-labelledby={headingId}>
      <h3 id={headingId}>Saldo do plano de {petName}</h3>
      <p>{at ? `Para o atendimento em ${formatShopInput(at)}` : 'Usos disponíveis no período atual'}</p>
      <small>Assinatura válida até {dateTime(subscription.ends_at)}.</small>
      <div aria-live="polite" aria-busy={at !== null && !current}>
        {at === null ? <p>Selecione uma data e um horário para consultar o saldo desse período.</p> : !current ? (
          <p>Consultando saldo...</p>
        ) : current.error ? (
          <><p role="alert">{current.error}</p><Retry type="button" onClick={() => setAttempt((value) => value + 1)}>Consultar novamente</Retry></>
        ) : current.data ? (
          <>
            {current.data.status !== 'active' && <p>Esta assinatura não está ativa para novas reservas.</p>}
            {current.data.services.length === 0 ? <p>Não há limites configurados para esta assinatura. Consulte o pet shop.</p> : (
              <Items>
                {current.data.services.map((item) => (
                  <Item key={item.service}>
                    <strong>{item.service}</strong>
                    <Balance $empty={item.remaining === 0}>{item.remaining === 0 ? 'Sem usos disponíveis' : `${item.remaining} de ${item.limit} usos disponíveis`}</Balance>
                    <small>{item.used} uso(s) reservado(s) ou consumido(s).</small>
                    <small>De {dateTime(item.period_starts_at)} até {dateTime(item.period_ends_at)} (fim exclusivo).</small>
                  </Item>
                ))}
              </Items>
            )}
            <p>Cancelamentos aceitos liberam uso. Faltas consomem uso.</p>
            {editing && <p>O saldo inclui a reserva original, se ela estiver neste período. Ao salvar, o sistema considera a substituição do seu agendamento.</p>}
            {at && <p>O saldo será conferido novamente ao salvar. Se estiver esgotado, escolha outro período ou selecione serviço avulso.</p>}
          </>
        ) : null}
      </div>
    </Panel>
  );
}

const Panel = styled.section`min-width:0;padding:14px;border:1px solid #BED9E8;border-radius:18px;background:#fff;color:#17324D;h3{font-size:1rem;margin:0 0 8px;}p{font-size:.88rem;line-height:1.5;margin:8px 0;}small{display:block;line-height:1.5;color:#475569;}overflow-wrap:anywhere;`;
const Items = styled.ul`display:grid;gap:10px;list-style:none;padding:0;margin:12px 0;`;
const Item = styled.li`display:grid;gap:4px;padding-bottom:10px;border-bottom:1px solid #DDEAF3;&:last-child{border-bottom:0;padding-bottom:0;}`;
const Balance = styled.span<{ $empty: boolean }>`font-weight:800;color:${({ $empty }) => $empty ? '#A32435' : '#256D85'}!important;font-size:.9rem;`;
const Retry = styled.button`min-height:40px;padding:8px 12px;border:1px solid #BED9E8;border-radius:12px;background:#fff;color:#17324D;font-weight:800;`;
