import { expect, test, describe, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CouncilResults from './CouncilResults';
import { COUNCIL_FIXTURE } from '../lib/fixtures';

const renderResults = (
  phase: Parameters<typeof CouncilResults>[0]['phase'],
  rehearsalId: string | null = null,
  errorMessage?: string,
) =>
  render(
    <CouncilResults
      phase={phase}
      rehearsalId={rehearsalId}
      result={COUNCIL_FIXTURE}
      errorMessage={errorMessage}
    />,
  );

describe('CouncilResults', () => {
  test('shows empty state when phase is idle', () => {
    renderResults('idle');
    expect(screen.getByTestId('council-empty')).toBeInTheDocument();
    expect(screen.getByText('议会结论')).toBeInTheDocument();
  });

  test('shows loading state during SPECIALISTS_RUNNING', () => {
    renderResults('SPECIALISTS_RUNNING', 'test-001');
    expect(screen.getByTestId('council-loading')).toBeInTheDocument();
    expect(screen.getByText(/正在等待三位专家完成分析/)).toBeInTheDocument();
  });

  test('shows error state when phase is FAILED', () => {
    renderResults('FAILED', null, '模型服务暂时不可用');
    expect(screen.getByTestId('council-error')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('模型服务暂时不可用')).toBeInTheDocument();
    expect(screen.getByText(/点击“新建演练”后重试/)).toBeInTheDocument();
  });

  test('shows results when phase is READY', () => {
    renderResults('READY', 'test-001');
    expect(screen.getByTestId('council-ready')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '共识' })).toBeInTheDocument();
    expect(screen.getByText('分歧与证据缺口')).toBeInTheDocument();
    expect(screen.getByText('决策演练')).toBeInTheDocument();
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
