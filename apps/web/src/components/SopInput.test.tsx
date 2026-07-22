import { expect, test, describe, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SopInput from './SopInput';

describe('SopInput', () => {
  test('renders title and content fields', () => {
    render(<SopInput onSubmit={() => {}} />);
    expect(screen.getByTestId('sop-title')).toBeInTheDocument();
    expect(screen.getByTestId('sop-content')).toBeInTheDocument();
    expect(screen.getByTestId('submit-sop')).toBeInTheDocument();
  });

  test('submit button is disabled when fields are empty', () => {
    render(<SopInput onSubmit={() => {}} />);
    const btn = screen.getByTestId('submit-sop');
    expect(btn).toBeDisabled();
  });

  test('calls onSubmit with trimmed title when form is valid', () => {
    const handleSubmit = vi.fn();
    render(<SopInput onSubmit={handleSubmit} />);

    const titleInput = screen.getByTestId('sop-title');
    const contentInput = screen.getByTestId('sop-content');

    fireEvent.change(titleInput, { target: { value: '  Test SOP  ' } });
    fireEvent.change(contentInput, { target: { value: 'Some content' } });

    const btn = screen.getByTestId('submit-sop');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(handleSubmit).toHaveBeenCalledWith({
      title: 'Test SOP',
      content: 'Some content',
      locale: 'zh-CN',
    });
  });

  test('shows byte counter', () => {
    render(<SopInput onSubmit={() => {}} />);
    expect(screen.getByText(/0 \/ 60,000 bytes/)).toBeInTheDocument();
  });
});
