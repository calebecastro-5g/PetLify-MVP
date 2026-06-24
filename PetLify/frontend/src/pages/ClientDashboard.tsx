import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import DashboardShell from '../components/DashboardShell';
import ProfileEditor from '../components/ProfileEditor';
import Spinner from '../components/Spinner';
import { apiFetch } from '../lib/api';
import { CatalogItem, formatCurrency, platformPlans, platformServices } from '../lib/catalog';

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
  notes?: string | null;
  billing_type?: string;
  payment_required?: boolean;
  payment_amount?: number;
  payment_item_id?: string | null;
  requires_payment_update?: boolean;
};

type VaccineRecord = {
  id: number;
  pet_name: string;
  vaccine_name: string;
  applied_at: string;
  valid_until?: string | null;
  veterinarian?: string | null;
  status: string;
};

type Notification = {
  id: string;
  title: string;
  description: string;
  level: 'info' | 'warning' | 'danger';
};

type Payment = {
  id: number;
  method: string;
  amount: number;
  item_name?: string | null;
  item_type?: string | null;
  created_at: string;
  appointment_id?: number | null;
};

type Slot = {
  value: string;
  time: string;
  label: string;
  duration_minutes: number;
};

const breedOptions = ['SRD', 'Shih-tzu', 'Poodle', 'Golden Retriever', 'Bulldog', 'Labrador', 'Yorkshire', 'Pinscher', 'Persa', 'Siamês', 'Maine Coon', 'Outra'];
const initialPetForm = { name: '', species: 'Cão', breed: 'SRD', size: 'Pequeno', age: '1' };
const initialAppointmentForm = { petId: '', billing: 'avulso', serviceId: platformServices[0].id, date: '', slot: '', notes: '' };

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR');
}


function toDateTimeInput(value: string) {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function serviceById(serviceId: string) {
  return platformServices.find((service) => service.id === serviceId) || platformServices[0];
}

function serviceByName(name: string) {
  return platformServices.find((service) => service.name === name || service.displayName === name) || platformServices[0];
}

function planServices(plan?: string | null): CatalogItem[] {
  const normalized = (plan || '').toLowerCase();
  if (!normalized) return [];
  if (normalized.includes('premium plus')) return platformServices;
  if (normalized.includes('premium') || normalized.includes('básico') || normalized.includes('basico')) {
    return platformServices.filter((service) => ['Banho', 'Tosa'].includes(service.name));
  }
  return [];
}

function ClientDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vaccineRecords, setVaccineRecords] = useState<VaccineRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showPetForm, setShowPetForm] = useState(false);
  const [editingPetId, setEditingPetId] = useState<number | null>(null);
  const [petForm, setPetForm] = useState(initialPetForm);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [editingAppointmentId, setEditingAppointmentId] = useState<number | null>(null);
  const [appointmentForm, setAppointmentForm] = useState(initialAppointmentForm);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedPlanPetId, setSelectedPlanPetId] = useState('');
  const [savingPet, setSavingPet] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const petOptions = useMemo(() => pets.map((pet) => ({ value: String(pet.id), label: pet.name })), [pets]);
  const selectedPet = useMemo(() => pets.find((pet) => String(pet.id) === appointmentForm.petId), [pets, appointmentForm.petId]);
  const selectedPlanServices = useMemo(() => planServices(selectedPet?.plan), [selectedPet]);
  const billingIsPlan = appointmentForm.billing === 'plano' && selectedPlanServices.length > 0;
  const serviceOptions = billingIsPlan ? selectedPlanServices : platformServices;
  const selectedService = useMemo(
    () => serviceOptions.find((service) => service.id === appointmentForm.serviceId) || serviceOptions[0] || platformServices[0],
    [serviceOptions, appointmentForm.serviceId]
  );

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [petsResponse, appointmentsResponse, vaccinesResponse, notificationsResponse, paymentsResponse] = await Promise.all([
        apiFetch('/api/pets'),
        apiFetch('/api/appointments'),
        apiFetch('/api/vaccine-records'),
        apiFetch('/api/notifications'),
        apiFetch('/api/payments'),
      ]);
      if (!petsResponse.ok || !appointmentsResponse.ok || !vaccinesResponse.ok || !notificationsResponse.ok || !paymentsResponse.ok) {
        throw new Error('Falha ao carregar dados.');
      }

      const petsData = (await petsResponse.json()) as Pet[];
      setPets(petsData);
      setAppointments(await appointmentsResponse.json());
      setVaccineRecords(await vaccinesResponse.json());
      setNotifications(await notificationsResponse.json());
      setPayments(await paymentsResponse.json());

      if (!appointmentForm.petId && petsData[0]) {
        setAppointmentForm((prev) => ({ ...prev, petId: String(petsData[0].id) }));
      }
      if (!selectedPlanPetId && petsData[0]) {
        setSelectedPlanPetId(String(petsData[0].id));
      }
    } catch {
      setError('Não foi possível carregar seus dados agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    async function loadSlots() {
      if (!appointmentForm.petId || !appointmentForm.date) {
        setSlots([]);
        return;
      }
      setLoadingSlots(true);
      try {
        const query = new URLSearchParams({ pet_id: appointmentForm.petId, date: appointmentForm.date });
        if (editingAppointmentId) query.set('appointment_id', String(editingAppointmentId));
        const response = await apiFetch(`/api/appointment-slots?${query.toString()}`);
        const data = await response.json();
        if (response.ok) {
          setSlots(data.slots || []);
          setAppointmentForm((prev) => {
            const stillAvailable = (data.slots || []).some((slot: Slot) => slot.value === prev.slot);
            return { ...prev, slot: stillAvailable ? prev.slot : (data.slots?.[0]?.value || '') };
          });
        } else {
          setSlots([]);
        }
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
  }, [appointmentForm.petId, appointmentForm.date, editingAppointmentId]);

  useEffect(() => {
    if (appointmentForm.billing === 'plano' && selectedPlanServices.length === 0) {
      setAppointmentForm((prev) => ({ ...prev, billing: 'avulso', serviceId: platformServices[0].id }));
    }
    if (selectedPlanServices.length > 0 && appointmentForm.billing === 'plano') {
      const exists = selectedPlanServices.some((service) => service.id === appointmentForm.serviceId);
      if (!exists) setAppointmentForm((prev) => ({ ...prev, serviceId: selectedPlanServices[0].id }));
    }
  }, [selectedPlanServices, appointmentForm.billing, appointmentForm.serviceId]);

  const resetPetForm = () => {
    setPetForm(initialPetForm);
    setEditingPetId(null);
    setShowPetForm(false);
  };

  const resetAppointmentForm = () => {
    setAppointmentForm({ ...initialAppointmentForm, petId: petOptions[0]?.value || '' });
    setEditingAppointmentId(null);
    setShowAppointmentForm(false);
    setSlots([]);
  };

  const startEditPet = (pet: Pet) => {
    setEditingPetId(pet.id);
    setShowPetForm(true);
    setPetForm({ name: pet.name, species: pet.species, breed: pet.breed, size: pet.size, age: String(pet.age) });
  };

  const startEditAppointment = (appointment: Appointment) => {
    setEditingAppointmentId(appointment.id);
    setShowAppointmentForm(true);
    const inputDateTime = toDateTimeInput(appointment.scheduled_at);
    const planMode = Boolean(appointment.billing_type?.startsWith('Plano'));
    const service = serviceByName(appointment.service);
    setAppointmentForm({
      petId: String(appointment.pet_id),
      billing: planMode ? 'plano' : 'avulso',
      serviceId: service.id,
      date: inputDateTime.slice(0, 10),
      slot: inputDateTime,
      notes: appointment.notes || '',
    });
  };

  const handleSavePet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingPet(true);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(editingPetId ? `/api/pets/${editingPetId}` : '/api/pets', {
        method: editingPetId ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: petForm.name,
          species: petForm.species,
          breed: petForm.breed,
          size: petForm.size,
          age: Number(petForm.age),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível salvar o pet.');
        return;
      }
      setFeedback(editingPetId ? 'Pet atualizado com sucesso.' : 'Pet cadastrado com sucesso.');
      resetPetForm();
      await loadData();
    } catch {
      setError('Falha de conexão ao salvar o pet.');
    } finally {
      setSavingPet(false);
    }
  };

  const handleDeletePet = async (petId: number) => {
    if (!window.confirm('Deseja excluir este pet? Os agendamentos vinculados também serão removidos.')) return;
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível excluir o pet.');
        return;
      }
      setFeedback('Pet excluído com sucesso.');
      await loadData();
    } catch {
      setError('Falha de conexão ao excluir o pet.');
    }
  };

  const handleSaveAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingAppointment(true);
    setError('');
    setFeedback('');

    if (!appointmentForm.slot) {
      setError('Selecione um horário disponível para o agendamento.');
      setSavingAppointment(false);
      return;
    }

    try {
      const response = await apiFetch(editingAppointmentId ? `/api/appointments/${editingAppointmentId}` : '/api/appointments', {
        method: editingAppointmentId ? 'PUT' : 'POST',
        body: JSON.stringify({
          pet_id: Number(appointmentForm.petId),
          service: selectedService.name,
          scheduled_at: appointmentForm.slot,
          notes: appointmentForm.notes,
          billing_type: billingIsPlan ? 'Plano mensal' : 'Serviço avulso',
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível salvar o agendamento.');
        return;
      }

      if (billingIsPlan) {
        setFeedback(editingAppointmentId ? 'Agendamento do plano atualizado.' : 'Agendamento do plano criado com sucesso.');
        resetAppointmentForm();
        await loadData();
        return;
      }

      if (!editingAppointmentId || data.requires_payment_update || data.payment_required) {
        navigate(`/checkout?appointment_id=${data.id}&item_id=${selectedService.id}`);
        return;
      }

      setFeedback('Agendamento atualizado com sucesso.');
      resetAppointmentForm();
      await loadData();
    } catch {
      setError('Falha de conexão ao salvar o agendamento.');
    } finally {
      setSavingAppointment(false);
    }
  };

  const cancelAppointment = async (appointmentId: number) => {
    if (!window.confirm('Deseja cancelar este agendamento? Cancelamentos com menos de 6 horas podem exigir pagamento.')) return;
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/appointments/${appointmentId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Cancelado' }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível cancelar o agendamento.');
        return;
      }
      setFeedback('Agendamento cancelado com sucesso.');
      await loadData();
    } catch {
      setError('Falha de conexão ao cancelar o agendamento.');
    }
  };

  const deleteAppointment = async (appointmentId: number) => {
    if (!window.confirm('Deseja excluir este agendamento?')) return;
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/appointments/${appointmentId}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível excluir o agendamento.');
        return;
      }
      setFeedback('Agendamento excluído com sucesso.');
      await loadData();
    } catch {
      setError('Falha de conexão ao excluir o agendamento.');
    }
  };

  const goToPlanPayment = (planId: string, petId?: string) => {
    const targetPetId = petId || selectedPlanPetId || petOptions[0]?.value;
    if (!targetPetId) {
      setError('Cadastre um pet antes de assinar um plano.');
      return;
    }
    navigate(`/checkout?item_id=${planId}&pet_id=${targetPetId}`);
  };

  return (
    <DashboardShell
      roleLabel="Área do Cliente"
      title="Seu pet shop conectado ao Petlify"
      subtitle="Cadastre pets, contrate planos por pet e agende horários disponíveis sem conflitos na agenda do pet shop."
      notificationCount={notifications.length}
      actions={<CartButton type="button" onClick={() => navigate('/checkout')} title="Checkout de planos" aria-label="Ir para o checkout">🛒</CartButton>}
      navItems={[
        { label: 'Meu perfil', href: '#perfil', icon: '👤' },
        { label: 'Notificações', href: '#notificacoes', icon: '🔔' },
        { label: 'Pets', href: '#pets', icon: '🐾' },
        { label: 'Agenda', href: '#agenda', icon: '📅' },
        { label: 'Vacinação', href: '#vacinas', icon: '💉' },
        { label: 'Pagamentos', href: '#pagamentos', icon: '💳' },
        { label: 'Planos', href: '#planos', icon: '⭐' },
      ]}
    >
      {loading ? (
        <Loading><Spinner /> Carregando painel...</Loading>
      ) : (
        <>
          {(feedback || error) && <Feedback error={!!error}>{error || feedback}</Feedback>}

          <ProfileEditor description="Sua conta pertence a um pet shop específico. Atualize seus dados para manter o atendimento e os lembretes em dia." />

          <Section id="notificacoes">
            <SectionHeader><div><Eyebrow>Central de alertas</Eyebrow><h2>Notificações</h2></div></SectionHeader>
            {notifications.length === 0 ? (
              <EmptyState><strong>Nenhum alerta pendente.</strong><span>Quando houver vacinas próximas do vencimento, elas aparecerão aqui.</span></EmptyState>
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
              <div><Eyebrow>Cadastro principal</Eyebrow><h2>Meus Pets</h2></div>
              <ActionRow>
                {showPetForm && <GhostButton type="button" onClick={resetPetForm}>Cancelar</GhostButton>}
                <ActionButton type="button" onClick={() => { setShowPetForm((value) => !value); if (!showPetForm) setEditingPetId(null); }}>
                  {showPetForm ? 'Fechar' : 'Cadastrar Pet'}
                </ActionButton>
              </ActionRow>
            </SectionHeader>

            {showPetForm && (
              <FormCard onSubmit={handleSavePet}>
                <Field><span>Nome</span><input value={petForm.name} onChange={(event) => setPetForm((prev) => ({ ...prev, name: event.target.value }))} required /></Field>
                <Field><span>Espécie</span><select value={petForm.species} onChange={(event) => setPetForm((prev) => ({ ...prev, species: event.target.value }))}><option>Cão</option><option>Gato</option><option>Outro</option></select></Field>
                <Field><span>Raça</span><select value={petForm.breed} onChange={(event) => setPetForm((prev) => ({ ...prev, breed: event.target.value }))}>{breedOptions.map((breed) => <option key={breed}>{breed}</option>)}</select></Field>
                <Field><span>Porte</span><select value={petForm.size} onChange={(event) => setPetForm((prev) => ({ ...prev, size: event.target.value }))}><option>Pequeno</option><option>Médio</option><option>Grande</option></select></Field>
                <Field><span>Idade</span><input type="number" min="0" value={petForm.age} onChange={(event) => setPetForm((prev) => ({ ...prev, age: event.target.value }))} required /></Field>
                <WideButton type="submit" disabled={savingPet}>{savingPet ? <Spinner size="18px" /> : editingPetId ? 'Salvar alterações' : 'Salvar pet'}</WideButton>
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
                    <PlanBadge>{pet.plan ? `Plano ${pet.plan}` : 'Sem plano'}</PlanBadge>
                    <InlineActions>
                      <MiniButton type="button" onClick={() => startEditPet(pet)}>Editar</MiniButton>
                      <MiniButton type="button" onClick={() => goToPlanPayment(platformPlans[0].id, String(pet.id))}>{pet.plan ? 'Trocar plano' : 'Assinar plano'}</MiniButton>
                      <MiniButton type="button" danger onClick={() => handleDeletePet(pet.id)}>Excluir</MiniButton>
                    </InlineActions>
                  </PetCard>
                ))}
              </CardGrid>
            )}
          </Section>

          <Section id="agenda">
            <SectionHeader>
              <div><Eyebrow>Agendamento</Eyebrow><h2>Meus Agendamentos</h2></div>
              <ActionRow>
                {showAppointmentForm && <GhostButton type="button" onClick={resetAppointmentForm}>Cancelar</GhostButton>}
                <ActionButton type="button" disabled={pets.length === 0} onClick={() => {
                  setShowAppointmentForm((value) => !value);
                  setEditingAppointmentId(null);
                  setAppointmentForm((prev) => ({ ...prev, petId: prev.petId || petOptions[0]?.value || '' }));
                }}>{showAppointmentForm ? 'Fechar' : 'Novo Agendamento'}</ActionButton>
              </ActionRow>
            </SectionHeader>

            {showAppointmentForm && (
              <FormCard onSubmit={handleSaveAppointment}>
                <Field><span>Pet</span><select value={appointmentForm.petId} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, petId: event.target.value }))} required>{petOptions.map((pet) => <option key={pet.value} value={pet.value}>{pet.label}</option>)}</select></Field>
                <Field><span>Tipo</span><select value={appointmentForm.billing} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, billing: event.target.value, serviceId: event.target.value === 'plano' && selectedPlanServices[0] ? selectedPlanServices[0].id : platformServices[0].id }))}>
                  {selectedPlanServices.length > 0 && <option value="plano">Usar plano mensal</option>}
                  <option value="avulso">Serviço avulso</option>
                </select></Field>
                <Field><span>Serviço</span><select value={appointmentForm.serviceId} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, serviceId: event.target.value }))}>{serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.displayName}</option>)}</select></Field>
                <Field><span>Valor</span><ReadOnlyValue>{billingIsPlan ? 'Coberto pelo plano' : formatCurrency(selectedService.amount)}</ReadOnlyValue></Field>
                <Field><span>Data</span><input type="date" value={appointmentForm.date} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, date: event.target.value, slot: '' }))} required /></Field>
                <Field><span>Horários disponíveis</span><select value={appointmentForm.slot} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, slot: event.target.value }))} disabled={loadingSlots || slots.length === 0} required>
                  {loadingSlots && <option>Carregando...</option>}
                  {!loadingSlots && slots.length === 0 && <option value="">Nenhum horário livre</option>}
                  {!loadingSlots && slots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                </select></Field>
                <Field className="full"><span>Observações</span><textarea value={appointmentForm.notes} onChange={(event) => setAppointmentForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Ex.: pet sensível ao secador" /></Field>
                <WideButton type="submit" disabled={savingAppointment || !appointmentForm.slot}>{savingAppointment ? <Spinner size="18px" /> : billingIsPlan ? 'Agendar pelo plano' : editingAppointmentId ? 'Salvar e revisar pagamento' : 'Agendar e pagar'}</WideButton>
              </FormCard>
            )}

            {appointments.length === 0 ? (
              <EmptyState><strong>Nenhum agendamento encontrado.</strong><span>Após cadastrar um pet, clique em Novo Agendamento para marcar um horário.</span></EmptyState>
            ) : (
              <List>
                {appointments.map((item) => (
                  <ListCard key={item.id}>
                    <div>
                      <strong>{item.service}</strong>
                      <span>{item.pet_name} • {formatDateTime(item.scheduled_at)}</span>
                      <small>{item.billing_type || 'Serviço'}{item.payment_amount ? ` • ${formatCurrency(item.payment_amount)}` : ''}</small>
                      {item.notes && <small>{item.notes}</small>}
                    </div>
                    <ListSide>
                      <Status>{item.status}</Status>
                      <InlineActions>
                        <MiniButton type="button" onClick={() => startEditAppointment(item)}>Editar</MiniButton>
                        <MiniButton type="button" onClick={() => cancelAppointment(item.id)}>Cancelar</MiniButton>
                        <MiniButton type="button" danger onClick={() => deleteAppointment(item.id)}>Excluir</MiniButton>
                      </InlineActions>
                    </ListSide>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="vacinas">
            <SectionHeader><div><Eyebrow>Saúde animal</Eyebrow><h2>Carteirinha de Vacinação</h2></div></SectionHeader>
            {vaccineRecords.length === 0 ? (
              <EmptyState><strong>Nenhuma vacina registrada.</strong><span>A carteirinha é atualizada pela equipe do pet shop.</span></EmptyState>
            ) : (
              <List>
                {vaccineRecords.map((record) => (
                  <ListCard key={record.id}>
                    <div>
                      <strong>{record.vaccine_name}</strong>
                      <span>{record.pet_name} • Aplicada em {formatDate(record.applied_at)}</span>
                      <small>{record.veterinarian || 'Responsável não informado'}{record.valid_until ? ` • Validade: ${formatDate(record.valid_until)}` : ''}</small>
                    </div>
                    <Status>{record.status}</Status>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="pagamentos">
            <SectionHeader><div><Eyebrow>Histórico financeiro</Eyebrow><h2>Meus pagamentos</h2></div></SectionHeader>
            {payments.length === 0 ? (
              <EmptyState><strong>Nenhum pagamento registrado.</strong><span>Após contratar um plano ou concluir um agendamento avulso, ele aparecerá aqui.</span></EmptyState>
            ) : (
              <List>
                {payments.map((payment) => (
                  <ListCard key={payment.id}>
                    <div><strong>{payment.item_name || 'Pagamento'}</strong><span>{payment.item_type || 'Item'} • {payment.method}</span><small>{formatDateTime(payment.created_at)}</small></div>
                    <Amount>{formatCurrency(payment.amount)}</Amount>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="planos">
            <SectionHeader><div><Eyebrow>Tabela oficial da plataforma</Eyebrow><h2>Planos e serviços</h2></div></SectionHeader>
            <Field className="plan-selector"><span>Escolha o pet para assinar um plano</span><select value={selectedPlanPetId} onChange={(event) => setSelectedPlanPetId(event.target.value)}>{petOptions.map((pet) => <option key={pet.value} value={pet.value}>{pet.label}</option>)}</select></Field>
            <SubsectionTitle>Planos mensais</SubsectionTitle>
            <CardGrid>
              {platformPlans.map((plan) => (
                <PriceCard key={plan.id}>
                  <strong>{plan.displayName}</strong>
                  <span>{plan.frequency}</span>
                  <small>{formatCurrency(plan.amount)}/mês</small>
                  <ActionButton type="button" onClick={() => goToPlanPayment(plan.id)}>Assinar este plano</ActionButton>
                </PriceCard>
              ))}
            </CardGrid>
            <SubsectionTitle>Serviços avulsos</SubsectionTitle>
            <CardGrid>
              {platformServices.map((service) => (
                <PriceCard key={service.id}>
                  <strong>{service.displayName}</strong>
                  <span>{service.description}</span>
                  <small>{formatCurrency(service.amount)}</small>
                </PriceCard>
              ))}
            </CardGrid>
          </Section>
        </>
      )}
    </DashboardShell>
  );
}

export default ClientDashboard;

const Loading = styled.div`min-height: 340px; display:grid; place-items:center; gap:12px; color:#64748B; font-weight:900;`;
const Section = styled.section`scroll-margin-top:20px;padding:24px;border-radius:28px;background:rgba(255,255,255,.88);border:1px solid #DDEAF3;box-shadow:0 18px 48px rgba(37,109,133,.10);`;
const SectionHeader = styled.div`display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:18px;h2{margin:4px 0 0;color:#17324D;}`;
const Eyebrow = styled.span`color:#256D85;font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;`;
const CartButton = styled.button`width:44px;height:44px;border:0;border-radius:16px;background:#FFFFFF;box-shadow:0 14px 32px rgba(23,50,77,.08);font-size:1.1rem;`;
const ActionRow = styled.div`display:flex;gap:10px;flex-wrap:wrap;`;
const ActionButton = styled.button`min-height:44px;border:0;border-radius:16px;padding:0 18px;background:#256D85;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;&:disabled{opacity:.55;}`;
const GhostButton = styled.button`min-height:44px;border:1px solid #DDEAF3;border-radius:16px;padding:0 18px;background:#fff;color:#17324D;font-weight:900;`;
const Feedback = styled.div<{ error: boolean }>`padding:14px 16px;border-radius:18px;background:${({ error }) => error ? '#FFE8EA' : '#DDF7F2'};color:${({ error }) => error ? '#A32435' : '#256D85'};font-weight:900;`;
const EmptyState = styled.div`padding:22px;border-radius:24px;background:#F8FCFF;border:1px dashed #BED9E8;display:grid;gap:6px;span{color:#64748B;}`;
const NotificationList = styled.div`display:grid;gap:12px;`;
const NotificationCard = styled.article<{ level: string }>`padding:18px;border-radius:22px;background:${({ level }) => level === 'danger' ? '#FFF1F3' : level === 'warning' ? '#FFFBE4' : '#F8FCFF'};border:1px solid ${({ level }) => level === 'danger' ? '#FFD7DC' : level === 'warning' ? '#F2E1A8' : '#DDEAF3'};display:grid;gap:6px;span{color:#64748B;}`;
const FormCard = styled.form`display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));align-items:end;padding:18px;border-radius:24px;background:#F8FCFF;border:1px solid #DDEAF3;margin-bottom:18px;.full{grid-column:1/-1;}textarea{min-height:96px;padding:14px;border:1px solid #DDEAF3;border-radius:16px;background:#fff;color:#17324D;resize:vertical;}`;
const Field = styled.label`display:grid;gap:8px;font-weight:800;input,select{min-height:46px;width:100%;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;}&.plan-selector{max-width:420px;margin-bottom:18px;}`;
const ReadOnlyValue = styled.div`min-height:46px;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;display:flex;align-items:center;font-weight:900;`;
const WideButton = styled(ActionButton)`grid-column:1/-1;`;
const CardGrid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;`;
const PetCard = styled.article`padding:20px;border-radius:24px;background:#F8FCFF;border:1px solid #DDEAF3;display:grid;gap:7px;span,small{color:#64748B;}`;
const Icon = styled.div`width:52px;height:52px;border-radius:20px;display:grid;place-items:center;background:#DDF7F2;font-size:1.4rem;`;
const PlanBadge = styled.span`width:fit-content;margin-top:4px;padding:7px 10px;border-radius:999px;background:#FFF6CC;color:#17324D!important;font-weight:900;font-size:.82rem;`;
const InlineActions = styled.div`display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;`;
const MiniButton = styled.button<{ danger?: boolean }>`min-height:34px;border:${({ danger }) => danger ? '0' : '1px solid #DDEAF3'};border-radius:999px;padding:0 12px;background:${({ danger }) => danger ? '#C93C58' : '#fff'};color:${({ danger }) => danger ? '#fff' : '#17324D'};font-weight:900;`;
const List = styled.div`display:grid;gap:12px;`;
const ListCard = styled.article`padding:16px 18px;border-radius:22px;background:#F8FCFF;border:1px solid #DDEAF3;display:flex;justify-content:space-between;gap:14px;align-items:center;@media(max-width:760px){align-items:flex-start;flex-direction:column;}`;
const ListSide = styled.div`display:grid;gap:10px;justify-items:end;@media(max-width:760px){justify-items:start;}`;
const Status = styled.span`padding:8px 12px;border-radius:999px;background:#E7F5FF;color:#256D85;font-weight:900;white-space:nowrap;`;
const Amount = styled.strong`font-size:1.1rem;color:#17324D;`;
const SubsectionTitle = styled.h3`margin:18px 0 12px;color:#17324D;`;
const PriceCard = styled.article`padding:18px;border-radius:22px;background:#F8FCFF;border:1px solid #DDEAF3;display:grid;gap:10px;span{color:#64748B;}small{font-size:1.05rem;font-weight:900;color:#256D85;}`;
