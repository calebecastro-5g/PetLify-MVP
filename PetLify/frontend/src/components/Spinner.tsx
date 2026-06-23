import styled, { keyframes } from 'styled-components';

type SpinnerProps = {
  size?: string;
};

function Spinner({ size = '28px' }: SpinnerProps) {
  return <Loader style={{ width: size, height: size }} aria-label="Carregando" />;
}

export default Spinner;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

const Loader = styled.span`
  display: inline-block;
  border: 3px solid rgba(37, 109, 133, 0.18);
  border-top-color: #256D85;
  border-radius: 999px;
  animation: ${spin} 0.8s linear infinite;
`;
