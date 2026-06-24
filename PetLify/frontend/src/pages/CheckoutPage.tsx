import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import Spinner from '../components/Spinner';
import { apiFetch } from '../lib/api';
import { CatalogItem, formatCurrency, platformCatalog, platformPlans, platformServices } from '../lib/catalog';

type Pet = {
  id: number;
  name: string;
  species: string;
  plan?: string | null;
};

const payments = ['PIX', 'Cartão de Crédito', 'Dinheiro'];

function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const appointmentIdParam = params.get('appointment_id');
  const itemIdParam = params.get('item_id');
  const petIdParam = params.get('pet_id');

  const requestedItem = platformCatalog.find((product) => product.id === itemIdParam) || platformPlans[0];
  const serviceFlow = Boolean(appointmentIdParam && requestedItem.type === 'Serviço avulso');

  const [selectedProductId, setSelectedProductId] = useState(requestedItem.type === 'Plano mensal' || serviceFlow ? requestedItem.id : platformPlans[0].id);
  const [selectedPayment, setSelectedPayment] = useState('PIX');
  const [selectedPetId, setSelectedPetId] = useState('');
  const [cashPassword, setCashPassword] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [loadingPets, setLoadingPets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedProduct: CatalogItem = useMemo(
    () => platformCatalog.find((product) => product.id === selectedProductId) || platformPlans[0],
    [selectedProductId]
  );

  const isPlan = selectedProduct.type === 'Plano mensal';

  useEffect(() => {
    async function loadPets() {
      setLoadingPets(true);
      try {
        const response = await apiFetch('/api/pets');
        if (response.ok) {
          const data = (await response.json()) as Pet[];
          setPets(data);
          if (petIdParam && data.some((pet) => String(pet.id) === petIdParam)) {
            setSelectedPetId(petIdParam);
          } else if (data[0]) {
            setSelectedPetId(String(data[0].id));
          }
        }
      } finally {
        setLoadingPets(false);
      }
    }
    loadPets();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (isPlan && !selectedPetId) {
      setError('Selecione o pet que receberá o plano mensal.');
      setLoading(false);
      return;
    }

    if (selectedPayment === 'Dinheiro' && cashPassword.length < 6) {
      setError('Pagamento em dinheiro exige a senha de um funcionário ou dono.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          method: selectedPayment,
          item_id: selectedProduct.id,
          item_name: selectedProduct.displayName,
          pet_id: isPlan ? Number(selectedPetId) : undefined,
          appointment_id: serviceFlow ? Number(appointmentIdParam) : undefined,
          employee_password: cashPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Não foi possível registrar o pagamento.');
        return;
      }
      setCashPassword('');
      setMessage(`Pagamento registrado: ${selectedProduct.displayName} — ${formatCurrency(selectedProduct.amount)}.`);
      setTimeout(() => navigate('/cliente'), 900);
    } catch {
      setError('Falha de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page>
      <Header>
        <button type="button" onClick={() => navigate(-1)}>← Voltar</button>
        <span>🛒</span>
        <div>
          <strong>Checkout Petlify</strong>
          <p>{serviceFlow ? 'Conclua o pagamento do serviço avulso criado no agendamento.' : 'Planos mensais com tabela fixa e igual para todos os pet shops.'}</p>
        </div>
      </Header>

      <Layout>
        <ProductsPanel>
          <Eyebrow>{serviceFlow ? 'Fluxo de agendamento' : 'Tabela oficial da plataforma'}</Eyebrow>
          <h1>{serviceFlow ? 'Pagamento do serviço agendado' : 'Planos mensais da plataforma'}</h1>
          <CatalogNote>
            {serviceFlow
              ? 'Serviços avulsos não são comprados de forma solta. Eles são contratados durante o agendamento e pagos aqui.'
              : 'Os valores são padronizados e todos os pet shops utilizam a mesma tabela de planos.'}
          </CatalogNote>

          {serviceFlow ? (
            <SingleProduct>
              <strong>{selectedProduct.displayName}</strong>
              <span>{selectedProduct.description}</span>
              <small>{formatCurrency(selectedProduct.amount)}</small>
              <Tag>Agendamento #{appointmentIdParam}</Tag>
            </SingleProduct>
          ) : (
            <>
              <GroupTitle>Planos mensais</GroupTitle>
              <ProductGrid>
                {platformPlans.map((product) => (
                  <ProductCard key={product.id} active={product.id === selectedProductId} onClick={() => setSelectedProductId(product.id)} type="button">
                    <strong>{product.displayName}</strong>
                    <span>{product.frequency}</span>
                    <small>{formatCurrency(product.amount)}/mês</small>
                  </ProductCard>
                ))}
              </ProductGrid>

              <GroupTitle>Serviços avulsos</GroupTitle>
              <ServiceNote>Serviços avulsos aparecem nesta tabela apenas para consulta de valor. A contratação acontece dentro do agendamento.</ServiceNote>
              <ProductGrid>
                {platformServices.map((product) => (
                  <ReadOnlyCard key={product.id}>
                    <strong>{product.displayName}</strong>
                    <span>{product.description}</span>
                    <small>{formatCurrency(product.amount)}</small>
                  </ReadOnlyCard>
                ))}
              </ProductGrid>
            </>
          )}
        </ProductsPanel>

        <SummaryCard>
          <form onSubmit={handleSubmit}>
            <Eyebrow>Resumo da compra</Eyebrow>
            <SummaryTitle>{selectedProduct.displayName}</SummaryTitle>
            <SummaryText>{selectedProduct.description}</SummaryText>
            <Row><span>Tipo</span><strong>{selectedProduct.type}</strong></Row>
            <Row><span>Total</span><strong>{formatCurrency(selectedProduct.amount)}</strong></Row>
            {serviceFlow && <Row><span>Agendamento vinculado</span><strong>#{appointmentIdParam}</strong></Row>}
            {isPlan && (
              <Field>
                <span>Vincular plano ao pet</span>
                <select value={selectedPetId} onChange={(event) => setSelectedPetId(event.target.value)} disabled={loadingPets} required>
                  {pets.map((pet) => <option key={pet.id} value={pet.id}>{pet.name} ({pet.species})</option>)}
                </select>
              </Field>
            )}
            {isPlan && pets.length === 0 && <MiniAlert>Cadastre um pet antes de assinar um plano mensal.</MiniAlert>}
            <Field><span>Forma de pagamento</span><select value={selectedPayment} onChange={(event) => setSelectedPayment(event.target.value)}>{payments.map((payment) => <option key={payment}>{payment}</option>)}</select></Field>
            {selectedPayment === 'Dinheiro' && <Field><span>Senha do funcionário</span><input type="password" value={cashPassword} onChange={(event) => setCashPassword(event.target.value)} placeholder="Use Dev@123456 no demo" /></Field>}
            {(message || error) && <Feedback error={!!error}>{error || message}</Feedback>}
            <SubmitButton type="submit" disabled={loading || (isPlan && pets.length === 0)}>{loading ? <Spinner size="18px" /> : 'Registrar pagamento'}</SubmitButton>
          </form>
        </SummaryCard>
      </Layout>
    </Page>
  );
}

export default CheckoutPage;

const Page = styled.main`min-height:100vh;padding:clamp(18px,4vw,46px);`;
const Header = styled.header`max-width:1180px;margin:0 auto 24px;display:flex;gap:14px;align-items:center;button{border:0;border-radius:999px;padding:12px 16px;background:#fff;color:#17324D;font-weight:900;box-shadow:0 14px 32px rgba(23,50,77,.08);}span{width:54px;height:54px;border-radius:20px;display:grid;place-items:center;background:#DDF7F2;font-size:1.3rem;}strong{font-size:1.4rem;}p{margin:3px 0 0;color:#64748B;}`;
const Layout = styled.section`max-width:1180px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:20px;@media(max-width:900px){grid-template-columns:1fr;}`;
const ProductsPanel = styled.section`padding:28px;border-radius:32px;background:rgba(255,255,255,.9);border:1px solid #DDEAF3;box-shadow:0 20px 60px rgba(37,109,133,.12);h1{margin:6px 0 12px;font-size:clamp(2rem,4vw,3.4rem);line-height:1;letter-spacing:-.04em;}`;
const CatalogNote = styled.p`margin:0 0 22px;color:#64748B;line-height:1.6;`;
const GroupTitle = styled.h2`margin:22px 0 12px;color:#17324D;font-size:1.1rem;`;
const Eyebrow = styled.span`color:#256D85;font-weight:900;text-transform:uppercase;font-size:.78rem;letter-spacing:.08em;`;
const ProductGrid = styled.div`display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;`;
const ProductCard = styled.button<{ active: boolean }>`border:1px solid ${({ active }) => active ? '#8FD3F4' : '#DDEAF3'};border-radius:24px;background:${({ active }) => active ? '#E7F5FF' : '#F8FCFF'};padding:20px;text-align:left;display:grid;gap:8px;color:#17324D;transition:.16s ease;&:hover{transform:translateY(-2px);}span{color:#64748B;}small{font-size:1.1rem;font-weight:900;color:#256D85;}`;
const ReadOnlyCard = styled.article`border:1px solid #DDEAF3;border-radius:24px;background:#F8FCFF;padding:20px;text-align:left;display:grid;gap:8px;color:#17324D;span{color:#64748B;}small{font-size:1.1rem;font-weight:900;color:#256D85;}`;
const ServiceNote = styled.p`margin:0 0 14px;color:#64748B;line-height:1.6;`;
const SingleProduct = styled.article`padding:24px;border-radius:28px;background:#F8FCFF;border:1px solid #DDEAF3;display:grid;gap:8px;span{color:#64748B;}small{font-size:1.25rem;font-weight:900;color:#256D85;}`;
const Tag = styled.span`width:fit-content;padding:7px 11px;border-radius:999px;background:#FFF6CC;color:#17324D !important;font-weight:900;`;
const SummaryCard = styled.aside`height:fit-content;padding:26px;border-radius:32px;background:#fff;border:1px solid #DDEAF3;box-shadow:0 20px 60px rgba(37,109,133,.12);position:sticky;top:24px;form{display:grid;gap:15px;}`;
const SummaryTitle = styled.h2`margin:0;font-size:1.8rem;color:#17324D;`;
const SummaryText = styled.p`margin:0;color:#64748B;line-height:1.5;`;
const Row = styled.div`display:flex;justify-content:space-between;gap:12px;padding:14px;border-radius:18px;background:#F8FCFF;span{color:#64748B;}strong{color:#17324D;}`;
const Field = styled.label`display:grid;gap:8px;font-weight:800;select,input{min-height:48px;border:1px solid #DDEAF3;border-radius:16px;padding:0 14px;background:#fff;color:#17324D;}`;
const SubmitButton = styled.button`min-height:52px;border:0;border-radius:18px;background:#256D85;color:#fff;font-weight:900;display:inline-flex;align-items:center;justify-content:center;gap:8px;&:disabled{opacity:.55;}`;
const MiniAlert = styled.div`padding:12px 14px;border-radius:16px;background:#FFF6CC;color:#17324D;font-weight:800;`;
const Feedback = styled.div<{ error: boolean }>`padding:13px 15px;border-radius:16px;background:${({ error }) => error ? '#FFE8EA' : '#DDF7F2'};color:${({ error }) => error ? '#A32435' : '#256D85'};font-weight:900;`;
