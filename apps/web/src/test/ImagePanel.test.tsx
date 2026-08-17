import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImagePanel } from '../../components/panels/image/ImagePanel';

describe('ImagePanelImpl', () => {
  it('should show toast instead of alert when generate fails', async () => {
    const mockOnGenerate = vi.fn().mockRejectedValue(new Error('Generation failed'));
    const mockPushToast = vi.fn();
    
    render(
      <ImagePanel
        onGenerate={mockOnGenerate}
        pushToast={mockPushToast}
        models={[]}
      />
    );
    
    // Click generate button
    const generateButton = screen.getByText('Generate');
    fireEvent.click(generateButton);
    
    // Should call pushToast with error message, not alert
    expect(mockPushToast).toHaveBeenCalledWith(expect.stringContaining('failed'));
  });
});