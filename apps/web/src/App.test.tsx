import { beforeEach, expect, test, describe, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

// Mock Three.js and GSAP — these require native modules
vi.mock('./scene/CommandRoom', () => ({
  default: () => <div data-testid="mock-canvas" />,
}));

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sopscape-locale', 'zh-CN');
  });
  test('renders top bar with app name', () => {
    render(<App />);
    expect(screen.getByText('SOPscape Council')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  test('shows SOP input form in idle state', () => {
    render(<App />);
    expect(screen.getByTestId('sop-title')).toBeInTheDocument();
    expect(screen.getByTestId('sop-content')).toBeInTheDocument();
  });

  test('switches theme and language without leaving the command room', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('主题'), { target: { value: 'light' } });
    expect(document.documentElement.dataset.theme).toBe('light');
    fireEvent.change(screen.getByLabelText('语言'), { target: { value: 'en-US' } });
    expect(screen.getByText('Submit an SOP')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en-US');
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

  test('opens the guide and loads the local phishing demo without calling the API', () => {
    render(<App />);
    fireEvent.click(screen.getByTestId('guide-trigger'));
    expect(screen.getByRole('dialog')).toHaveTextContent('演示与操作指南');

    fireEvent.click(screen.getByTestId('load-demo'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('钓鱼邮件处置演示')).toBeInTheDocument();
    expect(screen.getByText('议会结果')).toBeInTheDocument();
  });
});
