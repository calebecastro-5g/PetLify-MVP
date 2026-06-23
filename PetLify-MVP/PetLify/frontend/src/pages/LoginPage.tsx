import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Spinner from '../components/Spinner';
import { apiFetch, saveSession, UserRole } from '../lib/api';
import logo from '../assets/petlify-logo.png';

type Mode = 'login' | 'register' | 'forgot';

type DevAccount = {
  label: string;
  role: UserRole;
  email: string;
};

type StoreOption = {
  id: number;
  name: string;
  tenant_key: string;
  address?: string | null;
};

const roles: Array<{ value: UserRole; label: string; hint: string }> = [
  { value: 'cliente', label: 'Cliente', hint: 'Agenda, pets, pagamentos e histórico' },
  { value: 'funcionario', label: 'Funcionário', hint: 'Agenda, vacinas e operação da loja' },
  { value: 'dono', label: 'Dono', hint: 'Equipe, financeiro e gestão do pet shop' },
];

const devAccounts: DevAccount[] = [
  { label: 'Cliente Dev', role: 'cliente', email: 'cliente@petlify.dev' },
  { label: 'Funcionário Dev', role: 'funcionario', email: 'funcionario@petlify.dev' },
  { label: 'Dono Dev', role: 'dono', email: 'dono@petlify.dev' },
  { label: 'Dono Maria', role: 'dono', email: 'dono.maria@petlify.dev' },
];

function routeByRole(role: string) {
  if (role === 'dono') return '/dono';
  if (role === 'funcionario') return '/funcionario';
  return '/cliente';
}

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<UserRole>('cliente');
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    cpf: '',
    phone: '',
    storeKey: 'default',
    storeName: '',
    storeAddress: '',
    acceptedLgpd: true,
    twoFactorCode: '',
  });
  const [pending2fa, setPending2fa] = useState(false);
  const [dev2faCode, setDev2faCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadStores() {
      try {
        const response = await apiFetch('/api/stores');
        if (response.ok) {
          const data = (await response.json()) as StoreOption[];
          setStores(data);
        }
      } catch {
        // busca auxiliar
      }
    }
    loadStores();
  }, []);

  const applyDevAccount = (account: DevAccount) => {
    setMode('login');
    setRole(account.role);
    setPending2fa(false);
    setDev2faCode('');
    setForm((prev) => ({
      ...prev,
      email: account.email,
      password: 'Dev@123456',
      storeKey: account.email.includes('.maria') ? 'petshop-da-maria' : 'default',
    }));
    setMessage(`${account.label} preenchido. Clique em Entrar.`);
    setError('');
  };

  const changeRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setPending2fa(false);
    setDev2faCode('');
    setError('');
    setMessage('');
  };

  const handleAuthSuccess = (data: { access_token: string; role: UserRole; name?: string }) => {
    saveSession(data.access_token, data.role, data.name);
    navigate(routeByRole(data.role));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'forgot') {
        const response = await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email: form.email }),
        });
        const data = await response.json();
        setMessage(data.message || 'Verifique seu e-mail para continuar.');
        setMode('login');
        return;
      }

      if (pending2fa) {
        const response = await apiFetch('/api/auth/verify-2fa', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, code: form.twoFactorCode }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Código inválido.');
          return;
        }
        handleAuthSuccess(data);
        return;
      }

      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register'
        ? {
            name: form.name,
            email: form.email,
            password: form.password,
            cpf: form.cpf,
            phone: form.phone,
            role,
            store_key: form.storeKey,
            store_name: form.storeName,
            store_address: form.storeAddress,
            accepted_lgpd: form.acceptedLgpd,
          }
        : { email: form.email, password: form.password, role };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Não foi possível autenticar.');
        return;
      }

      if (data.requires_2fa) {
        setPending2fa(true);
        setDev2faCode(data.dev_2fa_code || '');
        setMessage('Informe o código de verificação para continuar.');
        return;
      }

      handleAuthSuccess(data);
    } catch {
      setError('Erro de conexão com o servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <HeroPanel>
        <BrandCard>
          <img src={logo} alt="Logo Petlify" />
          <div>
            <small>Plataforma SaaS para pet shops</small>
            <h1>Uma experiência mais clara, leve e integrada para cuidar do seu pet shop.</h1>
            <p>
              O Petlify reúne agenda, vacinação, planos, serviços e gestão em um único sistema. Cada pet shop possui seus próprios dados e o mesmo catálogo oficial da plataforma.
            </p>
          </div>
        </BrandCard>

        <FeatureGrid>
          <Feature><strong>Multi-tenant</strong><span>Cada loja acessa apenas seus próprios dados.</span></Feature>
          <Feature><strong>Planos fixos</strong><span>Os valores são iguais para todos os pet shops.</span></Feature>
          <Feature><strong>Compra no fluxo certo</strong><span>Serviços avulsos são pagos dentro do agendamento.</span></Feature>
        </FeatureGrid>
      </HeroPanel>

      <AuthCard>
        <ModeTabs>
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setPending2fa(false); }}>Entrar</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setPending2fa(false); }}>Criar conta</button>
        </ModeTabs>

        {mode !== 'forgot' && (
          <RoleGrid>
            {roles.map((item) => (
              <RoleButton key={item.value} type="button" active={role === item.value} onClick={() => changeRole(item.value)}>
                <strong>{item.label}</strong>
                <span>{item.hint}</span>
              </RoleButton>
            ))}
          </RoleGrid>
        )}

        {mode === 'login' && (
          <DevBar>
            {devAccounts.map((account) => (
              <button key={account.email} type="button" onClick={() => applyDevAccount(account)}>{account.label}</button>
            ))}
          </DevBar>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <Field><span>Nome completo</span><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></Field>
              <Field><span>CPF</span><input value={form.cpf} onChange={(event) => setForm((prev) => ({ ...prev, cpf: event.target.value }))} placeholder="Somente números" /></Field>
              <Field><span>Telefone</span><input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="(48) 99999-9999" /></Field>
            </>
          )}

          {mode === 'register' && role === 'dono' && (
            <TenantBox>
              <strong>Cadastrar meu Pet Shop</strong>
              <small>Crie o estabelecimento que será administrado por você dentro da plataforma.</small>
              <Field><span>Nome do estabelecimento</span><input value={form.storeName} onChange={(event) => setForm((prev) => ({ ...prev, storeName: event.target.value }))} placeholder="Ex.: Pet Shop da Maria" required /></Field>
              <Field><span>Endereço do Pet Shop</span><input value={form.storeAddress} onChange={(event) => setForm((prev) => ({ ...prev, storeAddress: event.target.value }))} placeholder="Rua, número, bairro" /></Field>
              <Field><span>Identificador do convite</span><input value={form.storeKey} onChange={(event) => setForm((prev) => ({ ...prev, storeKey: event.target.value }))} placeholder="petshop-da-maria" /></Field>
            </TenantBox>
          )}

          {mode === 'register' && role === 'cliente' && (
            <Field>
              <span>Pet Shop onde você será atendido</span>
              <select value={form.storeKey} onChange={(event) => setForm((prev) => ({ ...prev, storeKey: event.target.value }))} required>
                {stores.length === 0 && <option value="default">Petlify Centro</option>}
                {stores.map((store) => <option key={store.tenant_key} value={store.tenant_key}>{store.name}</option>)}
              </select>
            </Field>
          )}

          {mode === 'register' && role === 'funcionario' && (
            <Field><span>Chave do Pet Shop</span><input value={form.storeKey} onChange={(event) => setForm((prev) => ({ ...prev, storeKey: event.target.value }))} placeholder="Informe a chave da loja" required /></Field>
          )}

          <Field><span>E-mail</span><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></Field>
          <Field><span>Senha</span><input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required /></Field>

          {pending2fa && (
            <Field><span>Código de verificação</span><input value={form.twoFactorCode} onChange={(event) => setForm((prev) => ({ ...prev, twoFactorCode: event.target.value }))} placeholder="000000" required /></Field>
          )}

          {(message || error) && <Feedback error={!!error}>{error || message}</Feedback>}
          {!!dev2faCode && <Helper>Ambiente de desenvolvimento: use o código <strong>{dev2faCode}</strong>.</Helper>}

          <SubmitButton type="submit" disabled={loading}>
            {loading ? <Spinner size="18px" /> : pending2fa ? 'Validar código' : mode === 'register' ? 'Criar conta' : 'Entrar'}
          </SubmitButton>
        </form>

        <FootActions>
          <button type="button" onClick={() => { setMode(mode === 'forgot' ? 'login' : 'forgot'); setPending2fa(false); }}>{mode === 'forgot' ? 'Voltar ao login' : 'Esqueci minha senha'}</button>
        </FootActions>
      </AuthCard>
    </Page>
  );
}

export default LoginPage;

const Page = styled.main`
  min-height: 100vh;
  padding: clamp(18px, 4vw, 40px);
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(360px, 460px);
  gap: 24px;
  align-items: center;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;
const HeroPanel = styled.section`display:grid;gap:22px;`;
const BrandCard = styled.div`
  padding: clamp(24px, 4vw, 38px);
  border-radius: 36px;
  background: rgba(255,255,255,.9);
  border: 1px solid #DDEAF3;
  box-shadow: 0 24px 80px rgba(37,109,133,.12);
  display:grid;
  gap:24px;
  align-items:center;
  grid-template-columns: 170px 1fr;

  img { width: 100%; max-width: 160px; justify-self:center; }
  small { display:inline-flex; padding:8px 12px; border-radius:999px; background:#E7F5FF; color:#256D85; font-weight:900; text-transform:uppercase; letter-spacing:.08em; }
  h1 { margin:12px 0 12px; font-size: clamp(2rem, 4vw, 3.8rem); line-height: .98; color:#17324D; }
  p { margin:0; color:#64748B; line-height:1.7; max-width:720px; }

  @media (max-width: 740px) {
    grid-template-columns: 1fr;
    text-align:center;
    img { max-width: 140px; }
  }
`;
const FeatureGrid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;`;
const Feature = styled.article`padding:18px 20px;border-radius:24px;background:rgba(255,255,255,.84);border:1px solid #DDEAF3;display:grid;gap:6px;strong{color:#17324D;}span{color:#64748B;line-height:1.5;}`;
const AuthCard = styled.section`padding:28px;border-radius:32px;background:#fff;border:1px solid #DDEAF3;box-shadow:0 24px 80px rgba(37,109,133,.12);`;
const ModeTabs = styled.div`display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px;button{min-height:48px;border:1px solid #DDEAF3;border-radius:16px;background:#F8FCFF;color:#17324D;font-weight:900;}.active{background:#17324D;color:#fff;border-color:#17324D;}`;
const RoleGrid = styled.div`display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:16px;`;
const RoleButton = styled.button<{ active: boolean }>`padding:14px;border-radius:18px;border:1px solid ${({ active }) => active ? '#8FD3F4' : '#DDEAF3'};background:${({ active }) => active ? '#E7F5FF' : '#F8FCFF'};text-align:left;display:grid;gap:3px;strong{color:#17324D;}span{color:#64748B;font-size:.95rem;}`;
const DevBar = styled.div`display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;button{min-height:38px;border:1px dashed #BED9E8;border-radius:999px;background:#F8FCFF;padding:0 12px;color:#256D85;font-weight:900;}`;
const Field = styled.label`display:grid;gap:8px;font-weight:800;margin-bottom:14px;input,select{min-height:48px;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;}`;
const TenantBox = styled.div`padding:18px;border-radius:24px;background:#F8FCFF;border:1px solid #DDEAF3;margin-bottom:14px;strong{display:block;color:#17324D;}small{display:block;color:#64748B;margin:6px 0 14px;}`;
const Feedback = styled.div<{ error: boolean }>`margin-bottom:12px;padding:14px 16px;border-radius:18px;background:${({ error }) => error ? '#FFE8EA' : '#DDF7F2'};color:${({ error }) => error ? '#A32435' : '#256D85'};font-weight:900;`;
const Helper = styled.div`margin-bottom:12px;padding:12px 14px;border-radius:16px;background:#FFF6CC;color:#17324D;font-weight:800;`;
const SubmitButton = styled.button`width:100%;min-height:50px;border:0;border-radius:18px;background:#256D85;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;`;
const FootActions = styled.div`margin-top:16px;display:flex;justify-content:center;button{border:0;background:transparent;color:#256D85;font-weight:900;}`;
