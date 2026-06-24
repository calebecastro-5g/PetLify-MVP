import { FormEvent, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import DashboardShell from '../components/DashboardShell';
import ProfileEditor from '../components/ProfileEditor';
import Spinner from '../components/Spinner';
import { apiFetch } from '../lib/api';

type Appointment = {
  id: number;
  client_name: string;
  pet_id: number;
  pet_name: string;
  service: string;
  scheduled_at: string;
  status: string;
};

type Pet = {
  id: number;
  name: string;
  species: string;
  breed: string;
  size: string;
  age: number;
  plan?: string | null;
  owner_name?: string | null;
  owner_cpf?: string | null;
  photo_icon?: string;
};

type VaccineRecord = {
  id: number;
  pet_id: number;
  pet_name: string;
  vaccine_name: string;
  applied_at: string;
  valid_until?: string | null;
  veterinarian?: string | null;
  lot?: string | null;
  status: string;
};

type Profile = { id: number; name: string; role: 'funcionario' | 'dono' | 'cliente' };

const statusOptions = ['Pendente', 'Confirmado', 'Concluído', 'Cancelado', 'Falta'];
const vaccineStatusOptions = ['Em dia', 'A vencer', 'Vencida', 'Cancelada'];
const dogVaccines = ['Polivalente V8/V10', 'Antirrábica', 'Giardíase', 'Gripe Canina', 'Leishmaniose', 'Outra'];
const catVaccines = ['Polivalente Felina V3/V4/V5', 'Antirrábica', 'Leucemia Felina (FeLV)', 'Outra'];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function isToday(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function EmployeeDashboard() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [currentEmployeeName, setCurrentEmployeeName] = useState('');
  const [search, setSearch] = useState('');
  const [showAllAgenda, setShowAllAgenda] = useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<number | null>(null);
  const [savingVaccine, setSavingVaccine] = useState(false);
  const [editingVaccineId, setEditingVaccineId] = useState<number | null>(null);
  const [vaccineForm, setVaccineForm] = useState({
    petId: '',
    vaccineName: 'Polivalente V8/V10',
    customName: '',
    appliedAt: '',
    validUntil: '',
    veterinarian: '',
    lot: '',
    status: 'Em dia',
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const selectedPet = pets.find((pet) => String(pet.id) === vaccineForm.petId);
  const vaccineOptions = selectedPet?.species === 'Gato' ? catVaccines : dogVaccines;

  const filteredPets = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pets;
    return pets.filter((pet) => [pet.name, pet.owner_name, pet.owner_cpf, pet.breed].some((value) => value?.toLowerCase().includes(term)));
  }, [pets, search]);

  const visibleAppointments = useMemo(
    () => (showAllAgenda ? appointments : appointments.filter((appointment) => isToday(appointment.scheduled_at))),
    [appointments, showAllAgenda]
  );

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [appointmentsResponse, petsResponse, vaccinesResponse, profileResponse] = await Promise.all([
        apiFetch('/api/appointments'),
        apiFetch('/api/pets'),
        apiFetch('/api/vaccine-records'),
        apiFetch('/api/me'),
      ]);
      if (!appointmentsResponse.ok || !petsResponse.ok || !vaccinesResponse.ok || !profileResponse.ok) {
        throw new Error('Falha ao carregar dados.');
      }
      const petsData = (await petsResponse.json()) as Pet[];
      const profileData = (await profileResponse.json()) as Profile;
      setAppointments(await appointmentsResponse.json());
      setPets(petsData);
      setVaccines(await vaccinesResponse.json());
      setCurrentEmployeeName(profileData.name);
      if (!vaccineForm.petId && petsData[0]) {
        setVaccineForm((prev) => ({ ...prev, petId: String(petsData[0].id), veterinarian: profileData.name }));
      } else {
        setVaccineForm((prev) => ({ ...prev, veterinarian: profileData.name }));
      }
    } catch {
      setError('Não foi possível carregar a operação agora.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const resetVaccineForm = () => {
    setEditingVaccineId(null);
    setVaccineForm({
      petId: pets[0] ? String(pets[0].id) : '',
      vaccineName: pets[0]?.species === 'Gato' ? catVaccines[0] : dogVaccines[0],
      customName: '',
      appliedAt: '',
      validUntil: '',
      veterinarian: currentEmployeeName,
      lot: '',
      status: 'Em dia',
    });
  };

  const updateAppointmentStatus = async (appointment: Appointment, status: string) => {
    setUpdatingAppointmentId(appointment.id);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/appointments/${appointment.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível atualizar o status.');
        return;
      }
      setFeedback('Status do agendamento atualizado.');
      await loadData();
    } catch {
      setError('Falha de conexão ao atualizar agendamento.');
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  const handleSaveVaccine = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingVaccine(true);
    setError('');
    setFeedback('');

    const vaccineName = vaccineForm.vaccineName === 'Outra' ? vaccineForm.customName : vaccineForm.vaccineName;
    if (!vaccineName.trim()) {
      setError('Informe o nome da vacina.');
      setSavingVaccine(false);
      return;
    }

    try {
      const response = await apiFetch(editingVaccineId ? `/api/vaccine-records/${editingVaccineId}` : '/api/vaccine-records', {
        method: editingVaccineId ? 'PUT' : 'POST',
        body: JSON.stringify({
          pet_id: Number(vaccineForm.petId),
          vaccine_name: vaccineName,
          applied_at: vaccineForm.appliedAt,
          valid_until: vaccineForm.validUntil,
          lot: vaccineForm.lot,
          status: vaccineForm.status,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível salvar a vacina.');
        return;
      }
      setFeedback(editingVaccineId ? 'Vacina atualizada com sucesso.' : 'Vacina registrada na carteirinha do pet.');
      resetVaccineForm();
      await loadData();
    } catch {
      setError('Falha de conexão ao salvar a vacina.');
    } finally {
      setSavingVaccine(false);
    }
  };

  const startEditVaccine = (record: VaccineRecord) => {
    setEditingVaccineId(record.id);
    setVaccineForm({
      petId: String(record.pet_id),
      vaccineName: record.vaccine_name,
      customName: '',
      appliedAt: new Date(record.applied_at).toISOString().slice(0, 16),
      validUntil: record.valid_until ? new Date(record.valid_until).toISOString().slice(0, 16) : '',
      veterinarian: record.veterinarian || currentEmployeeName,
      lot: record.lot || '',
      status: record.status,
    });
  };

  const cancelVaccine = async (recordId: number) => {
    if (!window.confirm('Deseja cancelar este registro de vacina?')) return;
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/vaccine-records/${recordId}/cancel`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível cancelar a vacina.');
        return;
      }
      setFeedback('Registro de vacina cancelado.');
      await loadData();
    } catch {
      setError('Falha de conexão ao cancelar a vacina.');
    }
  };


  const handleDeletePet = async (pet: Pet) => {
    if (!window.confirm(`Deseja excluir o pet ${pet.name}?`)) return;
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch(`/api/pets/${pet.id}`, { method: 'DELETE' });
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

  return (
    <DashboardShell
      roleLabel="Área do Funcionário"
      title="Operação do dia sem bagunça"
      subtitle="Acompanhe a agenda, encontre pets por tutor ou CPF e registre vacinas com rastreabilidade e responsável vinculado." 
      navItems={[
        { label: 'Meu perfil', href: '#perfil', icon: '👤' },
        { label: 'Agenda', href: '#agenda', icon: '📅' },
        { label: 'Buscar pets', href: '#pets', icon: '🔎' },
        { label: 'Carteirinha', href: '#vacinas', icon: '💉' },
        { label: 'Planos', href: '#planos', icon: '⭐' },
      ]}
    >
      {loading ? (
        <Loading><Spinner /> Carregando operação...</Loading>
      ) : (
        <>
          {(feedback || error) && <Feedback error={!!error}>{error || feedback}</Feedback>}
          <ProfileEditor description="Mantenha seus dados atualizados para auditoria de agenda, vacinas e confirmações operacionais." />

          <Section id="agenda">
            <SectionHeader>
              <div><Eyebrow>Agenda operacional</Eyebrow><h2>{showAllAgenda ? 'Todos os agendamentos' : 'Agendamentos de hoje'}</h2></div>
              <ActionButton type="button" onClick={() => setShowAllAgenda((value) => !value)}>{showAllAgenda ? 'Ver apenas hoje' : 'Ver agenda completa'}</ActionButton>
            </SectionHeader>
            {visibleAppointments.length === 0 ? (
              <EmptyState><strong>Nenhum agendamento nesta visão.</strong><span>Use a agenda completa para consultar registros passados e futuros.</span></EmptyState>
            ) : (
              <List>
                {visibleAppointments.map((appointment) => (
                  <ListCard key={appointment.id}>
                    <CardInfo>
                      <strong>{appointment.service}</strong>
                      <span>{appointment.pet_name} • {appointment.client_name}</span>
                      <small>{formatDateTime(appointment.scheduled_at)}</small>
                    </CardInfo>
                    <StatusControl>
                      <select value={appointment.status} onChange={(event) => updateAppointmentStatus(appointment, event.target.value)} disabled={updatingAppointmentId === appointment.id}>
                        {statusOptions.map((status) => <option key={status}>{status}</option>)}
                      </select>
                      {updatingAppointmentId === appointment.id && <Spinner size="18px" />}
                    </StatusControl>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="pets">
            <SectionHeader>
              <div><Eyebrow>Busca por tutor</Eyebrow><h2>Pets cadastrados</h2></div>
            </SectionHeader>
            <SearchInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome do pet, tutor, CPF ou raça" />
            {filteredPets.length === 0 ? (
              <EmptyState><strong>Nenhum pet encontrado.</strong><span>Confira o nome do tutor ou o CPF informado.</span></EmptyState>
            ) : (
              <PetGrid>
                {filteredPets.map((pet) => (
                  <PetCard key={pet.id}>
                    <Icon>{pet.photo_icon || '🐾'}</Icon>
                    <strong>{pet.name}</strong>
                    <span>{pet.species} • {pet.breed}</span>
                    <small>Tutor: {pet.owner_name || 'Não informado'}</small>
                    <small>CPF: {pet.owner_cpf || 'Não informado'}</small>
                    <PlanBadge>{pet.plan ? `Plano ${pet.plan}` : 'Sem plano'}</PlanBadge>
                    <MiniButton type="button" onClick={() => handleDeletePet(pet)}>Excluir pet</MiniButton>
                  </PetCard>
                ))}
              </PetGrid>
            )}
          </Section>

          <Section id="vacinas">
            <SectionHeader>
              <div><Eyebrow>Carteirinha digital</Eyebrow><h2>{editingVaccineId ? 'Editar vacina' : 'Registrar vacina'}</h2></div>
              {editingVaccineId && <ActionButton type="button" onClick={resetVaccineForm}>Cancelar edição</ActionButton>}
            </SectionHeader>
            <FormCard onSubmit={handleSaveVaccine}>
              <Field><span>Pet</span><select value={vaccineForm.petId} onChange={(event) => setVaccineForm((prev) => ({ ...prev, petId: event.target.value, vaccineName: event.target.value ? (pets.find((pet) => String(pet.id) === event.target.value)?.species === 'Gato' ? catVaccines[0] : dogVaccines[0]) : prev.vaccineName }))} required>{pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} — {pet.owner_name}</option>)}</select></Field>
              <Field><span>Vacina</span><select value={vaccineForm.vaccineName} onChange={(event) => setVaccineForm((prev) => ({ ...prev, vaccineName: event.target.value }))}>{vaccineOptions.map((vaccine) => <option key={vaccine}>{vaccine}</option>)}</select></Field>
              {vaccineForm.vaccineName === 'Outra' && <Field><span>Nome livre</span><input value={vaccineForm.customName} onChange={(event) => setVaccineForm((prev) => ({ ...prev, customName: event.target.value }))} /></Field>}
              <Field><span>Data de aplicação</span><input type="datetime-local" value={vaccineForm.appliedAt} onChange={(event) => setVaccineForm((prev) => ({ ...prev, appliedAt: event.target.value }))} required /></Field>
              <Field><span>Validade / próxima dose</span><input type="datetime-local" value={vaccineForm.validUntil} onChange={(event) => setVaccineForm((prev) => ({ ...prev, validUntil: event.target.value }))} /></Field>
              <ReadOnlyField><span>Responsável</span><strong>{currentEmployeeName || vaccineForm.veterinarian || 'Funcionário logado'}</strong></ReadOnlyField>
              <Field><span>Lote</span><input value={vaccineForm.lot} onChange={(event) => setVaccineForm((prev) => ({ ...prev, lot: event.target.value }))} /></Field>
              <Field><span>Status</span><select value={vaccineForm.status} onChange={(event) => setVaccineForm((prev) => ({ ...prev, status: event.target.value }))}>{vaccineStatusOptions.map((status) => <option key={status}>{status}</option>)}</select></Field>
              <WideButton type="submit" disabled={savingVaccine}>{savingVaccine ? <Spinner size="18px" /> : editingVaccineId ? 'Salvar alterações' : 'Registrar vacina'}</WideButton>
            </FormCard>
            {vaccines.length > 0 && (
              <List>
                {vaccines.slice(0, 8).map((record) => (
                  <ListCard key={record.id}>
                    <CardInfo>
                      <strong>{record.vaccine_name}</strong>
                      <span>{record.pet_name} • {new Date(record.applied_at).toLocaleDateString('pt-BR')}</span>
                      {record.veterinarian && <small>Responsável: {record.veterinarian}</small>}
                    </CardInfo>
                    <RightBlock>
                      <StatusPill>{record.status}</StatusPill>
                      <InlineActions>
                        <MiniButton type="button" onClick={() => startEditVaccine(record)}>Editar</MiniButton>
                        <MiniButton type="button" onClick={() => cancelVaccine(record.id)}>Cancelar</MiniButton>
                      </InlineActions>
                    </RightBlock>
                  </ListCard>
                ))}
              </List>
            )}
          </Section>

          <Section id="planos">
            <SectionHeader>
              <div><Eyebrow>Planos por pet</Eyebrow><h2>Visualização dos planos</h2></div>
            </SectionHeader>
            <PetGrid>
              {pets.map((pet) => <PlanCard key={pet.id}><strong>{pet.name}</strong><span>{pet.owner_name}</span><PlanBadge>{pet.plan ? `Plano ${pet.plan}` : 'Sem plano'}</PlanBadge></PlanCard>)}
            </PetGrid>
          </Section>
        </>
      )}
    </DashboardShell>
  );
}

export default EmployeeDashboard;

const Loading = styled.div`min-height: 340px; display: grid; place-items: center; gap: 12px; color: #64748B; font-weight: 900;`;
const Section = styled.section`scroll-margin-top: 20px; padding: 24px; border-radius: 28px; background: rgba(255,255,255,.88); border: 1px solid #DDEAF3; box-shadow: 0 18px 48px rgba(37,109,133,.1);`;
const SectionHeader = styled.div`display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 18px; flex-wrap: wrap; h2{margin:4px 0 0;color:#17324D;}`;
const Eyebrow = styled.span`color:#256D85;font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;`;
const ActionButton = styled.button`min-height:44px;border:0;border-radius:16px;padding:0 18px;background:#256D85;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;&:disabled{opacity:.55;}`;
const WideButton = styled(ActionButton)`grid-column:1 / -1;`;
const List = styled.div`display:grid;gap:12px;`;
const ListCard = styled.article`padding:16px 18px;border-radius:22px;background:#F8FCFF;border:1px solid #DDEAF3;display:flex;justify-content:space-between;gap:14px;align-items:center;@media(max-width:620px){align-items:flex-start;flex-direction:column;}`;
const CardInfo = styled.div`display:grid;gap:4px;span,small{color:#64748B;}`;
const StatusControl = styled.div`display:inline-flex;align-items:center;gap:8px;select{min-height:40px;border:1px solid #DDEAF3;border-radius:14px;padding:0 12px;background:#fff;color:#17324D;font-weight:800;}`;
const RightBlock = styled.div`display:grid;gap:10px;justify-items:end;@media(max-width:620px){justify-items:start;}`;
const StatusPill = styled.span`padding:8px 12px;border-radius:999px;background:#E7F5FF;color:#256D85;font-weight:900;white-space:nowrap;`;
const EmptyState = styled.div`padding:22px;border-radius:24px;background:#F8FCFF;border:1px dashed #BED9E8;display:grid;gap:6px;span{color:#64748B;}`;
const SearchInput = styled.input`width:100%;min-height:50px;border:1px solid #DDEAF3;border-radius:18px;padding:0 16px;background:#fff;color:#17324D;margin-bottom:16px;`;
const PetGrid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;`;
const PetCard = styled.article`padding:20px;border-radius:24px;background:#F8FCFF;border:1px solid #DDEAF3;display:grid;gap:7px;span,small{color:#64748B;}`;
const PlanCard = styled(PetCard)`background:linear-gradient(135deg,#E7F5FF,#fff);`;
const Icon = styled.div`width:52px;height:52px;border-radius:20px;display:grid;place-items:center;background:#DDF7F2;font-size:1.4rem;`;
const PlanBadge = styled.span`width:fit-content;margin-top:4px;padding:7px 10px;border-radius:999px;background:#FFF6CC;color:#17324D!important;font-weight:900;font-size:.82rem;`;
const FormCard = styled.form`margin-bottom:18px;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));align-items:end;padding:18px;border-radius:24px;background:#F8FCFF;border:1px solid #DDEAF3;`;
const Field = styled.label`display:grid;gap:8px;font-weight:800;input,select{min-height:46px;width:100%;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;}`;
const ReadOnlyField = styled.div`display:grid;gap:8px;font-weight:800;strong{min-height:46px;width:100%;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;display:flex;align-items:center;}`;
const InlineActions = styled.div`display:flex;flex-wrap:wrap;gap:8px;`;
const MiniButton = styled.button`min-height:34px;border:1px solid #DDEAF3;border-radius:999px;padding:0 12px;background:#fff;color:#17324D;font-weight:900;`;
const Feedback = styled.div<{ error: boolean }>`padding:14px 16px;border-radius:18px;background:${({ error }) => error ? '#FFE8EA' : '#DDF7F2'};color:${({ error }) => error ? '#A32435' : '#256D85'};font-weight:900;`;
