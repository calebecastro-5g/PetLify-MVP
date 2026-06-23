import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import DashboardShell from '../components/DashboardShell';
import ProfileEditor from '../components/ProfileEditor';
import Spinner from '../components/Spinner';
import { apiFetch } from '../lib/api';
import { formatCurrency, platformPlans, platformServices } from '../lib/catalog';

type Pet = {
  id: number;
  name: string;
  species: string;
  breed: string;
  size: string;
  age: number;
  plan?: string | null;
  photo_icon?: string;
};

type Appointment = {
  id: number;
  pet_id: number;
  pet_name: string;
  service: string;
  scheduled_at: string;
  status: string;
};

type VaccineRecord = {
  id: number;
  pet_id: number;
  pet_name: string;
  vaccine_name: string;
  applied_at: string;
  valid_until?: string | null;
  veterinarian?: string | null;
  status: string;
  notes?: string;
};

type Notification = {
  id: string;
  title: string;
  description: string;
  level: 'info' | 'warning' | 'danger';
};

const initialPetForm = {
  name: '',
  species: 'Cão',
  breed: 'SRD',
  size: 'Pequeno',
  age: '1',
  plan: 'Sem plano',
};

const initialAppointmentForm = {
  petId: '',
  service: 'Banho',
  scheduledAt: '',
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function planLabel(plan?: string | null) {
  return plan ? `Plano ${plan}` : 'Sem plano';
}

function ClientDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingPet, setSavingPet] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vaccineRecords, setVaccineRecords] = useState<VaccineRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPetForm, setShowPetForm] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [petForm, setPetForm] = useState(initialPetForm);
  const [appointmentForm, setAppointmentForm] = useState(initialAppointmentForm);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const petOptions = useMemo(
    () => pets.map((pet) => ({ label: `${pet.name} (${pet.species})`, value: String(pet.id) })),
    [pets]
  );

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [petsResponse, appointmentsResponse, vaccinesResponse, notificationsResponse] = await Promise.all([
        apiFetch('/api/pets'),
        apiFetch('/api/appointments'),
        apiFetch('/api/vaccine-records'),
        apiFetch('/api/notifications'),
      ]);

      if (!petsResponse.ok || !appointmentsResponse.ok || !vaccinesResponse.ok || !notificationsResponse.ok) {
        throw new Error('Falha ao carregar dados do painel.');
      }

      setPets(await petsResponse.json());
      setAppointments(await appointmentsResponse.json());
      setVaccineRecords(await vaccinesResponse.json());
      setNotifications(await notificationsResponse.json());
    } catch (err) {
      setError('Não foi possível carregar seus dados agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleCreatePet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPet(true);
    setError('');
    setFeedback('');

    try {
      const response = await apiFetch('/api/pets', {
        method: 'POST',
        body: JSON.stringify({
          name: petForm.name,
          species: petForm.species,
          breed: petForm.breed,
          size: petForm.size,
          age: Number(petForm.age),
          plan: petForm.plan,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível cadastrar o pet.');
        return;
      }

      setFeedback('Pet cadastrado com sucesso.');
      setPetForm(initialPetForm);
      setShowPetForm(false);
      await loadData();
    } catch (err) {
      setError('Falha de conexão ao cadastrar pet.');
    } finally {
      setSavingPet(false);
    }
  };

  const handleCreateAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingAppointment(true);
    setError('');
    setFeedback('');

    try {
      const response = await apiFetch('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          pet_id: Number(appointmentForm.petId),
          service: appointmentForm.service,
          scheduled_at: appointmentForm.scheduledAt,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível criar o agendamento.');
        return;
      }

      setFeedback('Agendamento criado com sucesso.');
      setAppointmentForm(initialAppointmentForm);
      setShowAppointmentForm(false);
      await loadData();
    } catch (err) {
      setError('Falha de conexão ao criar agendamento.');
    } finally {
      setSavingAppointment(false);
    }
  };

  return (
    <DashboardShell
      roleLabel="Área do Cliente"
      title="Seu pet shop conectado ao Petlify"
      subtitle="Acesse a loja à qual sua conta está vinculada, cadastre pets, acompanhe vacinas e contrate planos com tabela padronizada da plataforma."
      notificationCount={notifications.length}
      actions={<CartButton type="button" onClick={() => navigate('/checkout')} title="Checkout" aria-label="Ir para o checkout">🛒</CartButton>}
      navItems={[
        { label: 'Meu perfil', href: '#perfil', icon: '👤' },
        { label: 'Notificações', href: '#notificacoes', icon: '🔔' },
        { label: 'Pets', href: '#pets', icon: '🐾' },
        { label: 'Agenda', href: '#agenda', icon: '📅' },
        { label: 'Vacinação', href: '#vacinas', icon: '💉' },
        { label: 'Planos', href: '#planos', icon: '⭐' },
      ]}
    >
      {loading ? (
        <Loading><Spinner /> Carregando painel...</Loading>
      ) : (
        <>
          {(feedback || error) && <Feedback error={!!error}>{error || feedback}</Feedback>}

          <ProfileEditor description="Sua conta pertence a um Pet Shop específico. Atualize seus dados para agendamentos, lembretes e atendimento." />

          <Section id="notificacoes">
            <SectionHeader>
              <div>
                <Eyebrow>Central de alertas</Eyebrow>
                <h2>Notificações</h2>
              </div>
            </SectionHeader>
            {notifications.length === 0 ? (
              <EmptyState><strong>Nenhum alerta pendente.</strong><span>Quando uma vacina estiver próxima do vencimento, ela aparecerá aqui.</span></EmptyState>
            ) : (
              <NotificationList>
                {notifications.map((notification) => (
                  <NotificationCard key={notification.id} level={notification.level}>
                    <strong>{notification.title}</strong>
                    <span>{notification.description}</span>
                  </NotificationCard>
                ))}
              </NotificationList>
            )}
          </Section>

          <Section id="pets">
            <SectionHeader>
              <div>
                <Eyebrow>Cadastro principal</Eyebrow>
                <h2>Meus Pets</h2>
              </div>
              <ActionButton type="button" onClick={() => setShowPetForm((value) => !value)}>{showPetForm ? 'Fechar' : 'Cadastrar Pet'}</ActionButton>
            </SectionHeader>

            {showPetForm && (
              <FormCard onSubmit={handleCreatePet}>
                <Field><span>Nome</span><input value={petForm.name} onChange={(event) => setPetForm((prev) => ({ ...prev, name: event.target.value }))} required /></Field>
                <Field><span>Espécie</span><select value={petForm.species} onChange={(event) => setPetForm((prev) => ({ ...prev, species: event.target.value }))}><option>Cão</option><option>Gato</option><option>Outro</option></select></Field>
                <Field><span>Raça</span><select value={petForm.breed} onChange={(event) => setPetForm((prev) => ({ ...prev, breed: event.target.value }))}><option>SRD</option><option>Shih-tzu</option><option>Poodle</option><option>Golden Retriever</option><option>Bulldog</option><option>Persa</option><option>Outra</option></select></Field>
                <Field><span>Porte</span><select value={petForm.size} onChange={(event) => setPetForm((prev) => ({ ...prev, size: event.target.value }))}><option>Pequeno</option><option>Médio</option><option>Grande</option></select></Field>
                <Field><span>Idade</span><input type="number" min="0" value={petForm.age} onChange={(event) => setPetForm((prev) => ({ ...prev, age: event.target.value }))} required /></Field>
                <Field><span>Plano mensal</span><select value={petForm.plan} onChange={(event) => setPetForm((prev) => ({ ...prev, plan: event.target.value }))}><option>Sem plano</option>{platformPlans.map((plan) => <option key={plan.id} value={plan.name}>{plan.displayName}</option>)}</select></Field>
                <ActionButton type="submit" disabled={savingPet}>{savingPet ? <Spinner size="18px" /> : 'Salvar Pet'}</ActionButton>
              </FormCard>
            )}

            {pets.length === 0 ? (
              <EmptyState><strong>Nenhum pet cadastrado ainda.</strong><span>Clique em Cadastrar Pet para começar.</span></EmptyState>
            ) : (
              <CardGrid>
                {pets.map((pet) => (
                  <PetCard key={pet.id}>
                    <Icon>{pet.photo_icon || '🐾'}</Icon>
                    <strong>{pet.name}</strong>
                    <span>{pet.species} • {pet.breed}</span>
                    <small>{pet.size} • {pet.age} anos</small>
                    <PlanBadge>{planLabel(pet.plan)}</PlanBadge>
                  </PetCard>
                ))}
              </CardGrid>
            )}
          </Section>

          <Section id="agenda">
            <SectionHeader>
              <div>
                <Eyebrow>Agendamento</Eyebrow>
                <h2>Meus Agendamentos</h2>
              </div>
              <ActionButton type="button" disabled={pets.length === 0} onClick={() => {
                setShowAppointmentForm((value) => !value);
                setAppointmentForm((prev) => ({ ...prev, petId: prev.petId || petOptions[0]?.value || '' }));
              }}>{showAppointmentForm ? 'Fechar' : 'Novo Agendamento'}</ActionButton>
            </SectionHeader>

            {showAppointmentForm && (
              <FormCard onSubmit={handleCreateAppointment}>
                <Field><span>Pet</span><select value={appointmentForm.petId} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, petId: event.target.value }))} required>{petOptions.map((pet) => <option key={pet.value} value={pet.value}>{pet.label}</option>)}</select></Field>
                <Field><span>Serviço</span><select value={appointmentForm.service} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, service: event.target.value }))}>{platformServices.map((service) => <option key={service.id}>{service.name}</option>)}</select></Field>
                <Field><span>Data e horário</span><input type="datetime-local" value={appointmentForm.scheduledAt} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, scheduledAt: event.target.value }))} required /></Field>
                <ActionButton type="submit" disabled={savingAppointment}>{savingAppointment ? <Spinner size="18px" /> : 'Agendar'}</ActionButton>
              </FormCard>
            )}

            {appointments.length === 0 ? (
              <EmptyState><strong>Nenhum agendamento encontrado.</strong><span>Após cadastrar um pet, clique em Novo Agendamento para marcar um serviço avulso.</span></EmptyState>
            ) : (
              <List>
                {appointments.map((item) => (
                  <ListCard key={item.id}>
                    <div><strong>{item.service}</strong><span>{item.pet_name} • {formatDateTime(item.scheduled_at)}</span></div>
                    <Status>{item.status}</Status>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="vacinas">
            <SectionHeader>
              <div>
                <Eyebrow>Saúde animal</Eyebrow>
                <h2>Carteirinha de Vacinação</h2>
              </div>
            </SectionHeader>
            {vaccineRecords.length === 0 ? (
              <EmptyState><strong>Nenhuma vacina registrada.</strong><span>A carteirinha é atualizada pela equipe do pet shop.</span></EmptyState>
            ) : (
              <List>
                {vaccineRecords.map((record) => (
                  <ListCard key={record.id}>
                    <div><strong>{record.vaccine_name}</strong><span>{record.pet_name} • Aplicada em {new Date(record.applied_at).toLocaleDateString('pt-BR')}</span>{record.valid_until && <small>Validade: {new Date(record.valid_until).toLocaleDateString('pt-BR')}</small>}</div>
                    <Status>{record.status}</Status>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="planos">
            <SectionHeader>
              <div>
                <Eyebrow>Valores fixos da plataforma</Eyebrow>
                <h2>Planos Mensais</h2>
              </div>
              <ActionButton type="button" onClick={() => navigate('/checkout')}>Ver planos</ActionButton>
            </SectionHeader>
            <CardGrid>
              {platformPlans.map((plan) => (
                <PlanCard key={plan.id}>
                  <strong>{plan.displayName}</strong>
                  <span>{plan.frequency}</span>
                  <PlanPrice>{formatCurrency(plan.amount)}/mês</PlanPrice>
                </PlanCard>
              ))}
            </CardGrid>
          </Section>
        </>
      )}
    </DashboardShell>
  );
}

export default ClientDashboard;

const Loading = styled.div`
  min-height: 340px;
  display: grid;
  place-items: center;
  gap: 12px;
  color: #64748B;
  font-weight: 900;
`;

const Section = styled.section`
  scroll-margin-top: 20px;
  padding: 24px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #DDEAF3;
  box-shadow: 0 18px 48px rgba(37, 109, 133, 0.1);
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
  flex-wrap: wrap;

  h2 { margin: 4px 0 0; color: #17324D; }
`;

const Eyebrow = styled.span`
  color: #256D85;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
`;

const ActionButton = styled.button`
  min-height: 44px;
  border: 0;
  border-radius: 16px;
  padding: 0 18px;
  background: #256D85;
  color: #FFFFFF;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  &:disabled { opacity: 0.55; }
`;

const CartButton = styled.button`
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 18px;
  background: #DDF7F2;
  font-size: 1.1rem;
  box-shadow: 0 14px 32px rgba(23, 50, 77, 0.08);
`;

const FormCard = styled.form`
  margin-bottom: 18px;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  align-items: end;
  padding: 18px;
  border-radius: 24px;
  background: #F8FCFF;
  border: 1px solid #DDEAF3;
`;

const Field = styled.label`
  display: grid;
  gap: 8px;
  font-weight: 800;

  input, select {
    min-height: 46px;
    width: 100%;
    border: 1px solid #DDEAF3;
    border-radius: 16px;
    padding: 0 14px;
    background: #FFFFFF;
    color: #17324D;
  }
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
`;

const PetCard = styled.article`
  padding: 20px;
  border-radius: 24px;
  background: #F8FCFF;
  border: 1px solid #DDEAF3;
  display: grid;
  gap: 7px;

  strong { font-size: 1.1rem; }
  span, small { color: #64748B; }
`;

const PlanCard = styled(PetCard)`
  background: linear-gradient(135deg, #E7F5FF, #FFFFFF);
`;

const PlanPrice = styled.strong`
  color: #256D85;
`;

const Icon = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  background: #DDF7F2;
  font-size: 1.4rem;
`;

const PlanBadge = styled.span`
  width: fit-content;
  margin-top: 4px;
  padding: 7px 10px;
  border-radius: 999px;
  background: #FFF6CC;
  color: #17324D !important;
  font-weight: 900;
  font-size: 0.82rem;
`;

const List = styled.div`
  display: grid;
  gap: 12px;
`;

const ListCard = styled.article`
  padding: 16px 18px;
  border-radius: 22px;
  background: #F8FCFF;
  border: 1px solid #DDEAF3;
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;

  div { display: grid; gap: 4px; }
  span, small { color: #64748B; }

  @media (max-width: 620px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const Status = styled.span`
  padding: 8px 12px;
  border-radius: 999px;
  background: #E7F5FF;
  color: #256D85 !important;
  font-weight: 900;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  padding: 22px;
  border-radius: 24px;
  background: #F8FCFF;
  border: 1px dashed #BED9E8;
  display: grid;
  gap: 6px;

  span { color: #64748B; }
`;

const NotificationList = styled.div`
  display: grid;
  gap: 10px;
`;

const NotificationCard = styled.article<{ level: string }>`
  padding: 16px;
  border-radius: 20px;
  background: ${({ level }) => (level === 'danger' ? '#FFE8EA' : level === 'warning' ? '#FFF6CC' : '#E7F5FF')};
  display: grid;
  gap: 4px;

  span { color: #64748B; }
`;

const Feedback = styled.div<{ error: boolean }>`
  padding: 14px 16px;
  border-radius: 18px;
  background: ${({ error }) => (error ? '#FFE8EA' : '#DDF7F2')};
  color: ${({ error }) => (error ? '#A32435' : '#256D85')};
  font-weight: 900;
`;
