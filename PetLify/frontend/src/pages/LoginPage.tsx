import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Spinner from '../components/Spinner';
import { apiFetch, saveSession, UserRole } from '../lib/api';

type Mode = 'login' | 'register' | 'forgot';

type DevAccount = {
  label: string;
  role: UserRole;
  email: string;
};

const roles: Array<{ value: UserRole; label: string; hint: string }> = [
  { value: 'cliente', label: 'Cliente', hint: 'Agenda, pets, carteirinha e checkout' },
  { value: 'funcionario', label: 'Funcionário', hint: 'Agenda geral, vacinas e operação' },
  { value: 'dono', label: 'Dono', hint: 'Equipe, financeiro e gestão da loja' },
];

const devAccounts: DevAccount[] = [
  { label: 'Cliente Dev', role: 'cliente', email: 'cliente@petlify.dev' },
  { label: 'Funcionário Dev', role: 'funcionario', email: 'funcionario@petlify.dev' },
  { label: 'Dono Dev', role: 'dono', email: 'dono@petlify.dev' },
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
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    cpf: '',
    phone: '',
    storeKey: 'default',
    acceptedLgpd: true,
    twoFactorCode: '',
  });
  const [pending2fa, setPending2fa] = useState(false);
  const [dev2faCode, setDev2faCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const applyDevAccount = (account: DevAccount) => {
    setMode('login');
    setRole(account.role);
    setPending2fa(false);
    setDev2faCode('');
    setForm((prev) => ({
      ...prev,
      email: account.email,
      password: 'Dev@123456',
      storeKey: 'default',
    }));
    setMessage(`${account.label} preenchido. Clique em Entrar para acessar.`);
    setError('');
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
            accepted_lgpd: form.acceptedLgpd,
          }
        : { email: form.email, password: form.password, role };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'E-mail ou senha incorretos.');
        return;
      }

      if (data.requires_2fa) {
        setPending2fa(true);
        setDev2faCode(data.dev_2fa_code || '');
        setMessage('Informe o código de verificação para continuar.');
        return;
      }

      handleAuthSuccess(data);
    } catch (err) {
      setError('Erro de conexão com o servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <HeroPanel>
        <Brand><span>🐾</span> Petlify</Brand>
        <HeroTitle>Gestão leve para pet shops modernos.</HeroTitle>
        <HeroText>
          Organize agenda, pets, vacinação, planos, equipe e financeiro em uma plataforma web simples, responsiva e pronta para demonstração.
        </HeroText>
        <FeatureGrid>
          <Feature><strong>Agenda</strong><span>Cliente agenda, equipe acompanha.</span></Feature>
          <Feature><strong>Saúde</strong><span>Carteirinha digital por pet.</span></Feature>
          <Feature><strong>Gestão</strong><span>Dono visualiza equipe e receita.</span></Feature>
        </FeatureGrid>
      </HeroPanel>

      <AuthCard>
        <ModeTabs>
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setPending2fa(false); }}>Entrar</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setPending2fa(false); }}>Criar conta</button>
        </ModeTabs>

        <RoleGrid>
          {roles.map((item) => (
            <RoleButton key={item.value} type="button" active={role === item.value} onClick={() => setRole(item.value)}>
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </RoleButton>
          ))}
        </RoleGrid>

        <DevBar>
          {devAccounts.map((account) => (
            <button key={account.email} type="button" onClick={() => applyDevAccount(account)}>{account.label}</button>
          ))}
        </DevBar>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <Field><span>Nome completo</span><input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required /></Field>
              <Field><span>CPF</span><input value={form.cpf} onChange={(event) => setForm((prev) => ({ ...prev, cpf: event.target.value }))} placeholder="Opcional no MVP" /></Field>
              <Field><span>Telefone</span><input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="(48) 99999-9999" /></Field>
            </>
          )}

          <Field><span>E-mail</span><input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} required /></Field>
          <Field><span>Senha</span><input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} required /></Field>

          {(role === 'funcionario' || role === 'dono') && mode === 'register' && (
            <Field><span>Chave da loja</span><input value={form.storeKey} onChange={(event) => setForm((prev) => ({ ...prev, storeKey: event.target.value }))} required /></Field>
          )}

          {pending2fa && (
            <TwoFactorBox>
              <Field><span>Código 2FA</span><input value={form.twoFactorCode} onChange={(event) => setForm((prev) => ({ ...prev, twoFactorCode: event.target.value }))} maxLength={6} /></Field>
              {dev2faCode && <button type="button" onClick={() => setForm((prev) => ({ ...prev, twoFactorCode: dev2faCode }))}>Usar código {dev2faCode}</button>}
            </TwoFactorBox>
          )}

          {mode === 'register' && (
            <CheckLabel>
              <input type="checkbox" checked={form.acceptedLgpd} onChange={(event) => setForm((prev) => ({ ...prev, acceptedLgpd: event.target.checked }))} />
              Aceito os termos de consentimento e privacidade.
            </CheckLabel>
          )}

          {(message || error) && <Feedback error={!!error}>{error || message}</Feedback>}

          <SubmitButton type="submit" disabled={loading}>{loading ? <Spinner size="20px" /> : pending2fa ? 'Verificar código' : mode === 'register' ? 'Criar conta' : 'Entrar'}</SubmitButton>
        </form>

        <ForgotButton type="button" onClick={() => { setMode('forgot'); setPending2fa(false); }}>Esqueci minha senha</ForgotButton>
      </AuthCard>
    </Page>
  );
}

export default LoginPage;

const Page = styled.main`
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, 0.75fr);
  gap: 28px;
  align-items: center;
  padding: clamp(18px, 4vw, 54px);

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const HeroPanel = styled.section`
  min-height: 620px;
  border-radius: 36px;
  padding: clamp(28px, 5vw, 58px);
  background:
    linear-gradient(135deg, rgba(143, 211, 244, 0.92), rgba(221, 247, 242, 0.92)),
    #8FD3F4;
  color: #17324D;
  display: grid;
  align-content: space-between;
  box-shadow: 0 32px 90px rgba(37, 109, 133, 0.22);

  @media (max-width: 920px) {
    min-height: auto;
    gap: 28px;
  }
`;

const Brand = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  font-weight: 900;

  span {
    width: 46px;
    height: 46px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.82);
  }
`;

const HeroTitle = styled.h1`
  max-width: 760px;
  margin: 40px 0 0;
  font-size: clamp(3rem, 8vw, 6.6rem);
  line-height: 0.92;
  letter-spacing: -0.07em;
`;

const HeroText = styled.p`
  max-width: 680px;
  margin: 20px 0 0;
  color: rgba(23, 50, 77, 0.78);
  font-size: 1.1rem;
  line-height: 1.7;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

const Feature = styled.div`
  padding: 18px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.62);
  display: grid;
  gap: 4px;

  span { color: rgba(23, 50, 77, 0.72); }
`;

const AuthCard = styled.section`
  padding: 26px;
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #DDEAF3;
  box-shadow: 0 24px 70px rgba(37, 109, 133, 0.16);

  form { display: grid; gap: 14px; margin-top: 16px; }
`;

const ModeTabs = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 6px;
  border-radius: 20px;
  background: #F4FBFF;

  button {
    min-height: 46px;
    border: 0;
    border-radius: 16px;
    background: transparent;
    font-weight: 900;
    color: #64748B;
  }

  .active {
    color: #17324D;
    background: #FFFFFF;
    box-shadow: 0 10px 24px rgba(23, 50, 77, 0.08);
  }
`;

const RoleGrid = styled.div`
  margin-top: 14px;
  display: grid;
  gap: 10px;
`;

const RoleButton = styled.button<{ active: boolean }>`
  border: 1px solid ${({ active }) => (active ? '#8FD3F4' : '#DDEAF3')};
  border-radius: 20px;
  background: ${({ active }) => (active ? '#E7F5FF' : '#FFFFFF')};
  padding: 14px;
  text-align: left;
  display: grid;
  gap: 2px;

  strong { color: #17324D; }
  span { color: #64748B; font-size: 0.9rem; }
`;

const DevBar = styled.div`
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    border: 0;
    border-radius: 999px;
    padding: 9px 12px;
    background: #FFF6CC;
    color: #17324D;
    font-weight: 900;
    font-size: 0.86rem;
  }
`;

const Field = styled.label`
  display: grid;
  gap: 7px;
  font-weight: 800;
  color: #17324D;

  input {
    width: 100%;
    min-height: 50px;
    border: 1px solid #DDEAF3;
    border-radius: 16px;
    padding: 0 14px;
    background: #FFFFFF;
    color: #17324D;
  }
`;

const TwoFactorBox = styled.div`
  padding: 14px;
  border-radius: 20px;
  background: #F8FCFF;
  border: 1px solid #DDEAF3;
  display: grid;
  gap: 10px;

  button {
    border: 0;
    border-radius: 14px;
    min-height: 42px;
    background: #DDF7F2;
    color: #256D85;
    font-weight: 900;
  }
`;

const CheckLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 10px;
  color: #64748B;
  font-weight: 700;
`;

const Feedback = styled.div<{ error: boolean }>`
  padding: 13px 15px;
  border-radius: 16px;
  background: ${({ error }) => (error ? '#FFE8EA' : '#DDF7F2')};
  color: ${({ error }) => (error ? '#A32435' : '#256D85')};
  font-weight: 800;
`;

const SubmitButton = styled.button`
  min-height: 52px;
  border: 0;
  border-radius: 18px;
  background: #256D85;
  color: #FFFFFF;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const ForgotButton = styled.button`
  width: 100%;
  margin-top: 14px;
  border: 0;
  background: transparent;
  color: #256D85;
  font-weight: 900;
`;
