import { render, screen } from '@testing-library/react';
import App from './App';

test('renders William Stapleton main heading', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /William Stapleton/i, level: 1 });
  expect(heading).toBeInTheDocument();
});
