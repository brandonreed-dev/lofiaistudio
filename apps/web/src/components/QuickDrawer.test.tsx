import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickDrawer } from '@/components/layout/QuickDrawer';

// Mock navigator clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('QuickDrawer', () => {
  it('should render create options', () => {
    render(<QuickDrawer isOpen onClose={vi.fn()} />);
    
    expect(screen.getByText('Quick Create')).toBeDefined();
    expect(screen.getByText('New Project')).toBeDefined();
    expect(screen.getByText('New Agent')).toBeDefined();
  });

  it('should call onClose when dialog is dismissed', () => {
    const mockOnClose = vi.fn();
    render(<QuickDrawer isOpen onClose={mockOnClose} />);
    
    // Find and click close button
    const closeButton = screen.getByLabelText('Close');
    closeButton.click();
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});