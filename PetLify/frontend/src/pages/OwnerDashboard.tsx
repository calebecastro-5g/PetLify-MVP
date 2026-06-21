import { FormEvent, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import DashboardShell from '../components/DashboardShell';
import ProfileEditor from '../components/ProfileEditor';
import Spinner from '../components/Spinner';
import { apiFetch } from '../lib/api';

type Employee = { id: number; name: string; email: string; role: string; is_active: boolean; phone?: string | null };
type Pet = { id: number; name: string; species: string; plan?: string | null; owner_name?: string | null };
type Appointment = { id: number; client_name: string; pet_name: string; service: string; scheduled_at: string; status: string };
type Payment = { id: number; client_name: string; method: string; amount: number; item_name?: string | null; item_type?: string | null; created_at: string };
type AuditLog = { id: number; action: string; entity_type: string; timestamp: string; details?: string | null };

const initialEmployeeForm = { name: '', email: '', phone: '', password: 'Dev@123456', role: 'funcionario' };

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function OwnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [updatingEmployeeId, setUpdatingEmployeeId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const totalRevenue = useMemo(() => payments.reduce((sum, payment) => sum + payment.amount, 0), [payments]);
  const currentMonthRevenue = useMemo(() => {
    const now = new Date();
    return payments.filter((payment) => {
      const date = new Date(payment.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).reduce((sum, payment) => sum + payment.amount, 0);
  }, [payments]);
  const activeEmployees = employees.filter((employee) => employee.is_active).length;
  const pendingAppointments = appointments.filter((appointment) => appointment.status === 'Pendente').length;
  const completedAppointments = appointments.filter((appointment) => appointment.status === 'Concluído').length;
  const planCount = pets.filter((pet) => pet.plan && pet.plan !== 'Sem plano').length;

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [employeesResponse, petsResponse, appointmentsResponse, paymentsResponse, auditResponse] = await Promise.all([
        apiFetch('/api/employees'),
        apiFetch('/api/pets'),
        apiFetch('/api/appointments'),
        apiFetch('/api/payments'),
        apiFetch('/api/audit-logs'),
      ]);
      if (!employeesResponse.ok || !petsResponse.ok || !appointmentsResponse.ok || !paymentsResponse.ok || !auditResponse.ok) {
        throw new Error('Falha ao carregar painel do dono.');
      }
      setEmployees(await employeesResponse.json());
      setPets(await petsResponse.json());
      setAppointments(await appointmentsResponse.json());
      setPayments(await paymentsResponse.json());
      setAuditLogs(await auditResponse.json());
    } catch (err) {
      setError('Não foi possível carregar os dados administrativos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingEmployee(true);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(employeeForm),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível cadastrar o colaborador.');
        return;
      }
      setFeedback('Colaborador cadastrado com sucesso.');
      setEmployeeForm(initialEmployeeForm);
      await loadData();
    } catch (err) {
      setError('Falha de conexão ao cadastrar colaborador.');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleToggleEmployee = async (employee: Employee) => {
    setUpdatingEmployeeId(employee.id);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/employees/${employee.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: employee.name, phone: employee.phone || '', is_active: !employee.is_active }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível atualizar o colaborador.');
        return;
      }
      setFeedback(employee.is_active ? 'Acesso desativado.' : 'Acesso ativado.');
      await loadData();
    } catch (err) {
      setError('Falha de conexão ao atualizar colaborador.');
    } finally {
      setUpdatingEmployeeId(null);
    }
  };

  return (
    <DashboardShell
      roleLabel="Área do Dono"
      title="Gestão completa do pet shop"
      subtitle="Acompanhe receita, planos, agenda, equipe e rastreabilidade operacional em um painel executivo."
      navItems={[
        { label: 'Meu perfil', href: '#perfil', icon: '👤' },
        { label: 'Resumo', href: '#resumo', icon: '📊' },
        { label: 'Equipe', href: '#equipe', icon: '🧑‍💼' },
        { label: 'Financeiro', href: '#financeiro', icon: '💳' },
        { label: 'Agenda', href: '#agenda', icon: '📅' },
        { label: 'Auditoria', href: '#auditoria', icon: '🔒' },
      ]}
    >
      {loading ? (
        <Loading><Spinner /> Carregando gestão...</Loading>
      ) : (
        <>
          {(feedback || error) && <Feedback error={!!error}>{error || feedback}</Feedback>}
          <ProfileEditor description="Edite seus dados, altere a senha e atualize o nome da loja exibido no sistema." />

          <StatsGrid id="resumo">
            <StatCard><span>Receita do mês</span><strong>{formatCurrency(currentMonthRevenue)}</strong><small>Pagamentos registrados neste mês.</small></StatCard>
            <StatCard><span>Receita total</span><strong>{formatCurrency(totalRevenue)}</strong><small>Histórico financeiro do MVP.</small></StatCard>
            <StatCard><span>Planos ativos</span><strong>{planCount}</strong><small>Planos vinculados aos pets.</small></StatCard>
            <StatCard><span>Agenda pendente</span><strong>{pendingAppointments}</strong><small>{completedAppointments} atendimentos concluídos.</small></StatCard>
          </StatsGrid>

          <Section id="equipe">
            <SectionHeader><div><Eyebrow>Gestão de acesso</Eyebrow><h2>Equipe</h2></div></SectionHeader>
            <FormCard onSubmit={handleCreateEmployee}>
              <Field><span>Nome</span><input value={employeeForm.name} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))} required /></Field>
              <Field><span>E-mail</span><input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))} required /></Field>
              <Field><span>Telefone</span><input value={employeeForm.phone} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, phone: event.target.value }))} /></Field>
              <Field><span>Senha inicial</span><input value={employeeForm.password} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))} required /></Field>
              <Field><span>Perfil</span><select value={employeeForm.role} onChange={(event) => setEmployeeForm((prev) => ({ ...prev, role: event.target.value }))}><option value="funcionario">Funcionário</option><option value="dono">Dono</option></select></Field>
              <ActionButton type="submit" disabled={savingEmployee}>{savingEmployee ? <Spinner size="18px" /> : 'Cadastrar'}</ActionButton>
            </FormCard>

            <List>
              {employees.map((employee) => (
                <ListCard key={employee.id}>
                  <CardInfo><strong>{employee.name}</strong><span>{employee.email}</span><small>{employee.role === 'dono' ? 'Dono' : 'Funcionário'} • {employee.is_active ? 'Ativo' : 'Inativo'}</small></CardInfo>
                  <ActionButton type="button" onClick={() => handleToggleEmployee(employee)} disabled={updatingEmployeeId === employee.id}>{updatingEmployeeId === employee.id ? <Spinner size="18px" /> : employee.is_active ? 'Desativar' : 'Ativar'}</ActionButton>
                </ListCard>
              ))}
            </List>
          </Section>

          <Section id="financeiro">
            <SectionHeader><div><Eyebrow>Controle financeiro</Eyebrow><h2>Pagamentos recentes</h2></div></SectionHeader>
            {payments.length === 0 ? (
              <EmptyState><strong>Nenhum pagamento registrado.</strong><span>Pagamentos feitos pelo checkout aparecerão aqui.</span></EmptyState>
            ) : (
              <List>
                {payments.slice(0, 8).map((payment) => (
                  <ListCard key={payment.id}>
                    <CardInfo><strong>{payment.item_name || 'Pagamento'}</strong><span>{payment.client_name} • {payment.method}</span><small>{formatDate(payment.created_at)}</small></CardInfo>
                    <Money>{formatCurrency(payment.amount)}</Money>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="agenda">
            <SectionHeader><div><Eyebrow>Operação</Eyebrow><h2>Agenda recente</h2></div></SectionHeader>
            <List>
              {appointments.slice(0, 8).map((appointment) => (
                <ListCard key={appointment.id}>
                  <CardInfo><strong>{appointment.service}</strong><span>{appointment.pet_name} • {appointment.client_name}</span><small>{formatDate(appointment.scheduled_at)}</small></CardInfo>
                  <StatusPill>{appointment.status}</StatusPill>
                </ListCard>
              ))}
            </List>
          </Section>

          <Section id="auditoria">
            <SectionHeader><div><Eyebrow>Rastreabilidade</Eyebrow><h2>Auditoria</h2></div></SectionHeader>
            {auditLogs.length === 0 ? (
              <EmptyState><strong>Nenhum log ainda.</strong><span>Alterações em agenda, vacina e pagamento geram registros de auditoria.</span></EmptyState>
            ) : (
              <List>
                {auditLogs.slice(0, 8).map((log) => (
                  <ListCard key={log.id}>
                    <CardInfo><strong>{log.action}</strong><span>{log.entity_type}</span><small>{formatDate(log.timestamp)}</small></CardInfo>
                    <StatusPill>Log</StatusPill>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>
        </>
      )}
    </DashboardShell>
  );
}

export default OwnerDashboard;

const Loading = styled.div`min-height: 340px; display: grid; place-items: center; gap: 12px; color: #64748B; font-weight: 900;`;
const StatsGrid = styled.section`scroll-margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;`;
const StatCard = styled.article`padding:22px;border-radius:28px;background:linear-gradient(135deg,#E7F5FF,#FFFFFF);border:1px solid #DDEAF3;box-shadow:0 18px 48px rgba(37,109,133,.1);display:grid;gap:6px;span{color:#256D85;font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;}strong{font-size:clamp(2rem,4vw,3rem);letter-spacing:-.04em;color:#17324D;}small{color:#64748B;}`;
const Section = styled.section`scroll-margin-top:20px;padding:24px;border-radius:28px;background:rgba(255,255,255,.88);border:1px solid #DDEAF3;box-shadow:0 18px 48px rgba(37,109,133,.1);`;
const SectionHeader = styled.div`display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:18px;flex-wrap:wrap;h2{margin:4px 0 0;color:#17324D;}`;
const Eyebrow = styled.span`color:#256D85;font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;`;
const FormCard = styled.form`margin-bottom:18px;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));align-items:end;padding:18px;border-radius:24px;background:#F8FCFF;border:1px solid #DDEAF3;`;
const Field = styled.label`display:grid;gap:8px;font-weight:800;input,select{min-height:46px;width:100%;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;}`;
const ActionButton = styled.button`min-height:44px;border:0;border-radius:16px;padding:0 18px;background:#256D85;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;&:disabled{opacity:.55;}`;
const List = styled.div`display:grid;gap:12px;`;
const ListCard = styled.article`padding:16px 18px;border-radius:22px;background:#F8FCFF;border:1px solid #DDEAF3;display:flex;justify-content:space-between;gap:14px;align-items:center;@media(max-width:620px){align-items:flex-start;flex-direction:column;}`;
const CardInfo = styled.div`display:grid;gap:4px;span,small{color:#64748B;}`;
const Money = styled.strong`font-size:1.2rem;color:#256D85;white-space:nowrap;`;
const StatusPill = styled.span`padding:8px 12px;border-radius:999px;background:#E7F5FF;color:#256D85;font-weight:900;white-space:nowrap;`;
const EmptyState = styled.div`padding:22px;border-radius:24px;background:#F8FCFF;border:1px dashed #BED9E8;display:grid;gap:6px;span{color:#64748B;}`;
const Feedback = styled.div<{ error: boolean }>`padding:14px 16px;border-radius:18px;background:${({ error }) => error ? '#FFE8EA' : '#DDF7F2'};color:${({ error }) => error ? '#A32435' : '#256D85'};font-weight:900;`;
