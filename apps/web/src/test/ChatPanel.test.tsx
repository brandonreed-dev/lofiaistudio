import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatPanel } from '../../components/panels/chat/TextPanel';

describe('ChatPanel', () => {
  it('should not resubmit on same card double-click', async () => {
    const mockOnSend = vi.fn();
    render(<TextPanel onSend={mockOnSend} />);

    const card = screen.getByText('New Chat');
    // Double-click the same card
    fireEvent.doubleClick(card);
    fireEvent.doubleClick(card);

    // Should only create one chat, not two
    expect(mockOnSend).toHaveBeenCalledTimes(1);
  });
});