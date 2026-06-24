import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { clearSession } from '../lib/api';
import logo from '../assets/petlify-logo.png';

export type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type DashboardShellProps = {
  roleLabel: string;
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
  actions?: ReactNode;
  notificationCount?: number;
};

function DashboardShell({ roleLabel, title, subtitle, navItems, children, actions, notificationCount = 0 }: DashboardShellProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate('/');
  };

  return (
    <Shell>
      <Sidebar open={open}>
        <Brand onClick={() => navigate('/')} aria-label="Voltar ao login">
          <LogoImage src={logo} alt="Petlify" />
          <div>
            <strong>Petlify</strong>
            <span>{roleLabel}</span>
          </div>
        </Brand>

        <Nav>
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href} onClick={() => setOpen(false)}>
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </Nav>

        <SideNote>
          <strong>MVP acadêmico</strong>
          <span>Gestão SaaS para múltiplos pet shops, com agenda, pets, vacinas, planos e operação integrada.</span>
        </SideNote>
      </Sidebar>

      {open && <Backdrop onClick={() => setOpen(false)} />}

      <Main>
        <Topbar>
          <MenuButton type="button" onClick={() => setOpen((value) => !value)} aria-label="Abrir menu">
            ☰
          </MenuButton>

          <Hero>
            <Pill>{roleLabel}</Pill>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </Hero>

          <TopActions>
            {notificationCount > 0 && (
              <NotificationBadge title="Notificações">
                🔔 <span>{notificationCount}</span>
              </NotificationBadge>
            )}
            {actions}
            <LogoutButton type="button" onClick={logout}>Sair</LogoutButton>
          </TopActions>
        </Topbar>

        <Content>{children}</Content>
      </Main>
    </Shell>
  );
}

export default DashboardShell;

const Shell = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr);

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const Sidebar = styled.aside<{ open: boolean }>`
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 24px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(18px);
  border-right: 1px solid #DDEAF3;
  display: grid;
  align-content: start;
  gap: 26px;
  z-index: 20;

  @media (max-width: 980px) {
    position: fixed;
    width: min(86vw, 320px);
    transform: translateX(${({ open }) => (open ? '0' : '-110%')});
    transition: transform 0.2s ease;
    box-shadow: 0 24px 80px rgba(23, 50, 77, 0.18);
  }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(23, 50, 77, 0.28);
  z-index: 10;
`;

const Brand = styled.button`
  border: 0;
  background: transparent;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #17324D;
  text-align: left;

  strong {
    display: block;
    font-size: 1.3rem;
    font-weight: 900;
  }

  span {
    color: #64748B;
    font-size: 0.9rem;
  }
`;

const LogoImage = styled.img`
  width: 56px;
  height: 56px;
  object-fit: contain;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 16px 35px rgba(37, 109, 133, 0.12);
  padding: 4px;
`;

const Nav = styled.nav`
  display: grid;
  gap: 10px;
`;

const NavLink = styled.a`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  border-radius: 18px;
  color: #17324D;
  font-weight: 800;
  transition: 0.16s ease;

  &:hover {
    background: #E7F5FF;
    transform: translateX(2px);
  }
`;

const SideNote = styled.div`
  padding: 18px;
  border-radius: 22px;
  background: linear-gradient(135deg, #F4FBFF, #FFFFFF);
  border: 1px solid #DDEAF3;
  display: grid;
  gap: 6px;

  strong {
    font-size: 0.95rem;
  }

  span {
    color: #64748B;
    line-height: 1.4;
    font-size: 0.9rem;
  }
`;

const Main = styled.main`
  min-width: 0;
  padding: 28px;

  @media (max-width: 700px) {
    padding: 18px;
  }
`;

const Topbar = styled.header`
  max-width: 1180px;
  margin: 0 auto 26px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 18px;

  @media (max-width: 760px) {
    grid-template-columns: auto 1fr;
  }
`;

const MenuButton = styled.button`
  display: none;
  border: 0;
  width: 46px;
  height: 46px;
  border-radius: 16px;
  background: #FFFFFF;
  box-shadow: 0 14px 32px rgba(23, 50, 77, 0.08);
  color: #17324D;
  font-weight: 900;

  @media (max-width: 980px) {
    display: block;
  }
`;

const Hero = styled.div`
  h1 {
    margin: 8px 0 8px;
    font-size: clamp(2rem, 4vw, 3.35rem);
    line-height: 1;
    letter-spacing: -0.04em;
    color: #17324D;
  }

  p {
    max-width: 720px;
    margin: 0;
    color: #64748B;
    line-height: 1.6;
  }
`;

const Pill = styled.span`
  width: fit-content;
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: #E7F5FF;
  color: #256D85;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
`;

const TopActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;

  @media (max-width: 760px) {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
`;

const NotificationBadge = styled.div`
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  background: #FFFFFF;
  color: #17324D;
  font-weight: 900;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 14px 32px rgba(23, 50, 77, 0.08);

  span {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #256D85;
    color: white;
    font-size: 0.78rem;
  }
`;

const LogoutButton = styled.button`
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 16px;
  background: #17324D;
  color: #fff;
  font-weight: 900;
`;

const Content = styled.div`
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
`;
