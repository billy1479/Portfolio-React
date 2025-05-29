import { render, screen } from '@testing-library/react';
import App from './App';

test('renders William Stapleton heading', () => {
  render(<App />);
  const headingElement = screen.getByText(/William Stapleton/i);
  expect(headingElement).toBeInTheDocument();
});
