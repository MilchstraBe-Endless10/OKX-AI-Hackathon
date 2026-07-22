import { expect, test, describe, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock Three.js and GSAP — these require native modules
vi.mock('./scene/CommandRoom', () => ({
  default: () => <div data-testid="mock-canvas" />,
}));

describe('App', () => {
  test('renders top bar with app name', () => {
    render(<App />);
    expect(screen.getByText('SOPscape Council')).toBeInTheDocument();
  });

  test('shows SOP input form in idle state', () => {
    render(<App />);
    expect(screen.getByTestId('sop-title')).toBeInTheDocument();
    expect(screen.getByTestId('sop-content')).toBeInTheDocument();
  });

  test('has accessible top bar', () => {
    render(<App />);
    const banner = screen.getByRole('banner');
    expect(banner).toBeInTheDocument();
  });

  test('has two complementary sidebars for input and results', () => {
    render(<App />);
    const aside = screen.getAllByRole('complementary');
    expect(aside.length).toBe(2);
  });
});
