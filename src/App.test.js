import { render, screen } from '@testing-library/react';
import App from './App';

beforeAll(() => {
  // jsdom has no canvas; template previews simply stay as skeletons.
  HTMLCanvasElement.prototype.getContext = () => null;
});

test('renders the landing page hero and primary actions', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: /capture your best/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signup');
  expect(screen.getByRole('link', { name: /create your photo strip/i })).toHaveAttribute('href', '/booth');
});
