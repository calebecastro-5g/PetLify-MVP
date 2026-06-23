import { FormEvent, useEffect, useState } from 'react';
import styled from 'styled-components';
import Spinner from './Spinner';
import { apiFetch, clearSession } from '../lib/api';

type Profile = {
  id: number;
  name: string;
  email: string;
  cpf?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  role: 'cliente' | 'funcionario' | 'dono';
  accepted_lgpd: boolean;
  is_active: boolean;
  store_name?: string | null;
  store_key?: string | null;
  store_address?: string | null;
  invite_path?: string | null;
};

type ProfileEditorProps = {
  description: string;
};

const roleLabels: Record<Profile['role'], string> = {
  cliente: 'Cliente',
  funcionario: 'Funcionário',
  dono: 'Dono',
};

function getInitials(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'PL'
  );
}

function ProfileEditor({ description }: ProfileEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    birthDate: '',
    storeName: '',
    storeAddress: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch('/api/me');
      if (!response.ok) throw new Error('Falha ao carregar perfil.');
      const data = (await response.json()) as Profile;
      setProfile(data);
      setForm({
        name: data.name || '',
        email: data.email || '',
        cpf: data.cpf || '',
        phone: data.phone || '',
        birthDate: data.birth_date || '',
        storeName: data.store_name || '',
        storeAddress: data.store_address || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch {
      setError('Não foi possível carregar os dados do perfil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const cancelEditing = () => {
    if (profile) {
      setForm({
        name: profile.name || '',
        email: profile.email || '',
        cpf: profile.cpf || '',
        phone: profile.phone || '',
        birthDate: profile.birth_date || '',
        storeName: profile.store_name || '',
        storeAddress: profile.store_address || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    setEditing(false);
    setError('');
    setFeedback('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError('A confirmação precisa ser igual à nova senha.');
      setSaving(false);
      return;
    }

    try {
      const payload: Record<string, string> = {
        name: form.name,
        email: form.email,
        cpf: form.cpf,
        phone: form.phone,
        birth_date: form.birthDate,
      };
      if (profile?.role === 'dono') {
        payload.store_name = form.storeName;
        payload.store_address = form.storeAddress;
      }
      if (form.newPassword) {
        payload.current_password = form.currentPassword;
        payload.new_password = form.newPassword;
      }

      const response = await apiFetch('/api/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível atualizar o perfil.');
        return;
      }

      const updated = data.user as Profile;
      setProfile(updated);
      setForm({
        name: updated.name || '',
        email: updated.email || '',
        cpf: updated.cpf || '',
        phone: updated.phone || '',
        birthDate: updated.birth_date || '',
        storeName: updated.store_name || '',
        storeAddress: updated.store_address || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setFeedback('Perfil atualizado com sucesso.');
      setEditing(false);
    } catch {
      setError('Falha de conexão ao atualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    const confirmed = window.confirm('Deseja realmente desativar sua conta? Você sairá do sistema.');
    if (!confirmed) return;

    setDeactivating(true);
    setError('');
    setFeedback('');
    try {
      const response = await apiFetch('/api/me', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível desativar a conta.');
        return;
      }
      clearSession();
      window.location.href = '/';
    } catch {
      setError('Falha de conexão ao desativar a conta.');
    } finally {
      setDeactivating(false);
    }
  };

  if (loading) {
    return (
      <Card id="perfil">
        <InlineLoading><Spinner size="22px" /> Carregando perfil...</InlineLoading>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card id="perfil">
        <Message error>Perfil indisponível no momento.</Message>
      </Card>
    );
  }

  return (
    <Card id="perfil">
      <ProfileHeader>
        <Identity>
          <Avatar>{getInitials(profile.name)}</Avatar>
          <div>
            <Eyebrow>Meu Perfil</Eyebrow>
            <Title>{profile.name}</Title>
            <Description>{description}</Description>
          </div>
        </Identity>
        <Actions>
          <RoleChip>{roleLabels[profile.role]}</RoleChip>
          {editing ? (
            <SecondaryButton type="button" onClick={cancelEditing}>Cancelar</SecondaryButton>
          ) : (
            <PrimaryButton type="button" onClick={() => setEditing(true)}>Editar perfil</PrimaryButton>
          )}
        </Actions>
      </ProfileHeader>

      {(feedback || error) && <Message error={!!error}>{error || feedback}</Message>}

      {!editing ? (
        <>
          <InfoGrid>
            <InfoItem><span>Nome</span><strong>{profile.name}</strong></InfoItem>
            <InfoItem><span>E-mail</span><strong>{profile.email}</strong></InfoItem>
            <InfoItem><span>CPF</span><strong>{profile.cpf || 'Não informado'}</strong></InfoItem>
            <InfoItem><span>Telefone</span><strong>{profile.phone || 'Não informado'}</strong></InfoItem>
            <InfoItem><span>Pet Shop</span><strong>{profile.store_name || 'Petlify Pet Shop'}</strong></InfoItem>
            <InfoItem><span>Chave da loja</span><strong>{profile.store_key || 'default'}</strong></InfoItem>
            <InfoItem><span>Endereço do Pet Shop</span><strong>{profile.store_address || 'Não informado'}</strong></InfoItem>
            <InfoItem><span>Status</span><strong>{profile.is_active ? 'Ativo' : 'Inativo'}</strong></InfoItem>
            {profile.role === 'dono' && <InfoItem><span>Convite do cliente</span><strong>{profile.invite_path || '/cadastro/default'}</strong></InfoItem>}
          </InfoGrid>
          <DangerZone>
            <div>
              <strong>Desativar conta</strong>
              <span>A conta não será apagada definitivamente do histórico do MVP, apenas desativada.</span>
            </div>
            <DangerButton type="button" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? <Spinner size="18px" /> : 'Desativar conta'}
            </DangerButton>
          </DangerZone>
        </>
      ) : (
        <Form onSubmit={handleSubmit}>
          <Field><span>Nome</span><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></Field>
          <Field><span>E-mail</span><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></Field>
          <Field><span>CPF</span><input value={form.cpf} onChange={(event) => setForm((prev) => ({ ...prev, cpf: event.target.value }))} placeholder="Somente números" /></Field>
          <Field><span>Telefone</span><input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="(48) 99999-9999" /></Field>
          <Field><span>Data de nascimento</span><input type="date" value={form.birthDate} onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))} /></Field>
          {profile.role === 'dono' && (
            <>
              <Field><span>Nome da loja</span><input value={form.storeName} onChange={(event) => setForm((prev) => ({ ...prev, storeName: event.target.value }))} /></Field>
              <Field><span>Endereço do Pet Shop</span><input value={form.storeAddress} onChange={(event) => setForm((prev) => ({ ...prev, storeAddress: event.target.value }))} /></Field>
            </>
          )}

          <PasswordBox>
            <strong>Alterar senha</strong>
            <small>Preencha somente se quiser trocar a senha. Use 8+ caracteres, 1 maiúscula e 1 número.</small>
            <PasswordGrid>
              <Field><span>Senha atual</span><input type="password" value={form.currentPassword} onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))} /></Field>
              <Field><span>Nova senha</span><input type="password" value={form.newPassword} onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))} /></Field>
              <Field><span>Confirmar nova senha</span><input type="password" value={form.confirmPassword} onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} /></Field>
            </PasswordGrid>
          </PasswordBox>

          <PrimaryButton type="submit" disabled={saving}>{saving ? <Spinner size="18px" /> : 'Salvar alterações'}</PrimaryButton>
        </Form>
      )}
    </Card>
  );
}

export default ProfileEditor;

const Card = styled.section`
  padding: 26px;
  border-radius: 28px;
  background: rgba(255,255,255,.88);
  border: 1px solid #DDEAF3;
  box-shadow: 0 18px 48px rgba(37,109,133,.10);
`;
const InlineLoading = styled.div`min-height: 120px; display:grid; place-items:center; color:#64748B; font-weight:900; gap:10px;`;
const ProfileHeader = styled.div`display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;`;
const Identity = styled.div`display:flex;gap:16px;align-items:center;`;
const Avatar = styled.div`width:64px;height:64px;border-radius:24px;display:grid;place-items:center;background:linear-gradient(135deg,#8FD3F4,#DDF7F2);color:#17324D;font-size:1.3rem;font-weight:900;`;
const Eyebrow = styled.span`display:inline-block;color:#256D85;font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;`;
const Title = styled.h2`margin:4px 0 6px;color:#17324D;font-size:1.6rem;`;
const Description = styled.p`margin:0;color:#64748B;max-width:720px;line-height:1.55;`;
const Actions = styled.div`display:flex;gap:10px;align-items:center;flex-wrap:wrap;`;
const RoleChip = styled.span`padding:8px 12px;border-radius:999px;background:#E7F5FF;color:#256D85;font-weight:900;`;
const PrimaryButton = styled.button`min-height:46px;border:0;border-radius:16px;padding:0 18px;background:#256D85;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;`;
const SecondaryButton = styled.button`min-height:46px;border:1px solid #DDEAF3;border-radius:16px;padding:0 18px;background:#fff;color:#17324D;font-weight:900;`;
const Message = styled.div<{ error?: boolean }>`margin-top:18px;padding:14px 16px;border-radius:18px;background:${({ error }) => error ? '#FFE8EA' : '#DDF7F2'};color:${({ error }) => error ? '#A32435' : '#256D85'};font-weight:900;`;
const InfoGrid = styled.div`margin-top:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;`;
const InfoItem = styled.div`padding:16px;border-radius:20px;background:#F8FCFF;border:1px solid #DDEAF3;display:grid;gap:6px;span{color:#64748B;font-size:.92rem;}strong{color:#17324D;}`;
const DangerZone = styled.div`margin-top:20px;padding:18px;border-radius:22px;background:#FFF7F8;border:1px solid #FFD7DC;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap;strong{display:block;color:#A32435;}span{color:#7A5460;}`;
const DangerButton = styled.button`min-height:46px;border:0;border-radius:16px;padding:0 18px;background:#C93C58;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;&:disabled{opacity:.55;}`;
const Form = styled.form`margin-top:20px;display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));align-items:start;`;
const Field = styled.label`display:grid;gap:8px;font-weight:800;input,select{min-height:48px;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;}`;
const PasswordBox = styled.div`grid-column:1 / -1;padding:18px;border-radius:22px;background:#F8FCFF;border:1px solid #DDEAF3;display:grid;gap:10px;small{color:#64748B;}`;
const PasswordGrid = styled.div`display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));`;
