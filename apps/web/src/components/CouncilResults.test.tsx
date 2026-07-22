import { expect, test, describe, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CouncilResults from './CouncilResults';
import { COUNCIL_FIXTURE } from '../lib/fixtures';

const renderResults = (
  phase: Parameters<typeof CouncilResults>[0]['phase'],
  rehearsalId: string | null = null,
) => render(<CouncilResults phase={phase} rehearsalId={rehearsalId} result={COUNCIL_FIXTURE} />);

describe('CouncilResults', () => {
  test('shows empty state when phase is idle', () => {
    renderResults('idle');
    expect(screen.getByTestId('council-empty')).toBeInTheDocument();
    expect(screen.getByText('Council Results')).toBeInTheDocument();
  });

  test('shows loading state during SPECIALISTS_RUNNING', () => {
    renderResults('SPECIALISTS_RUNNING', 'test-001');
    expect(screen.getByTestId('council-loading')).toBeInTheDocument();
    expect(screen.getByText(/Waiting for analysis/)).toBeInTheDocument();
  });

  test('shows error state when phase is FAILED', () => {
    renderResults('FAILED');
    expect(screen.getByTestId('council-error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  test('shows results when phase is READY', () => {
    renderResults('READY', 'test-001');
    expect(screen.getByTestId('council-ready')).toBeInTheDocument();
    expect(screen.getByText('Consensus')).toBeInTheDocument();
    expect(screen.getByText('Disagreements')).toBeInTheDocument();
    expect(screen.getByText('Decision Points')).toBeInTheDocument();
  });

  test('renders decision option buttons', () => {
    renderResults('READY', 'test-001');
    expect(screen.getByTestId('decision-option-a')).toBeInTheDocument();
    expect(screen.getByTestId('decision-option-b')).toBeInTheDocument();
  });

  test('reports the selected decision', () => {
    const onDecision = vi.fn();
    render(
      <CouncilResults
        phase="READY"
        rehearsalId="test-001"
        result={COUNCIL_FIXTURE}
        onDecision={onDecision}
      />,
    );
    fireEvent.click(screen.getByTestId('decision-option-b'));
    expect(onDecision).toHaveBeenCalledWith('verify');
  });
});
