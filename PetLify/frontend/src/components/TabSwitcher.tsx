import styled from 'styled-components';

interface TabOption {
  label: string;
  value: string;
}

interface Props {
  options: TabOption[];
  active: string;
  onChange: (value: string) => void;
}

function TabSwitcher({ options, active, onChange }: Props) {
  return (
    <Wrapper>
      {options.map((option) => (
        <Tab
          key={option.value}
          active={active === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Tab>
      ))}
    </Wrapper>
  );
}

export default TabSwitcher;

const Wrapper = styled.div`
  background: #f4fbf8;
  border-radius: 20px;
  padding: 8px;
  display: flex;
  gap: 8px;
`;

const Tab = styled.button<{ active: boolean }>`
  flex: 1;
  border: none;
  border-radius: 16px;
  padding: 14px 18px;
  background: ${({ active }) => (active ? '#B2DFDB' : 'transparent')};
  color: ${({ active }) => (active ? '#0F3D35' : '#475569')};
  font-weight: 600;
`;
