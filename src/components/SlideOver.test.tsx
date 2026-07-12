import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { SlideOver } from './SlideOver';

describe('SlideOver', () => {
  it('renders as an accessible dialog with the given aria-label', () => {
    render(
      <SlideOver onClose={vi.fn()} ariaLabel="Test Drawer">
        <button>Inside</button>
      </SlideOver>
    );

    const dialog = screen.getByRole('dialog', { name: 'Test Drawer' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <SlideOver onClose={onClose} ariaLabel="Test Drawer">
        <button>Inside</button>
      </SlideOver>
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the drawer (dialog container) on mount', async () => {
    // jsdom never computes layout, so the offsetParent check used to skip
    // responsive-hidden elements always excludes real children here; the
    // component then falls back to focusing the dialog container itself,
    // which is what this asserts. A real browser resolves offsetParent and
    // focuses the first visible field instead (same code path).
    render(
      <SlideOver onClose={vi.fn()} ariaLabel="Test Drawer">
        <input placeholder="first field" />
        <button>Second</button>
      </SlideOver>
    );

    expect(await screen.findByRole('dialog', { name: 'Test Drawer' })).toHaveFocus();
  });

  // Regression test: a caller whose form state lives in the same component
  // that renders the drawer (e.g. ChecklistTemplateEditor) passes a new
  // onClose closure on every keystroke-triggered re-render. If the focus-trap
  // effect re-ran on every onClose identity change, it would steal focus back
  // to the first field after every keystroke, truncating input to one
  // character. The effect must only run once per mount.
  it('does not steal focus back to the first field when onClose is a new function on every render', async () => {
    const HostWithChangingOnClose: React.FC = () => {
      const [value, setValue] = useState('');
      return (
        <SlideOver onClose={() => {}} ariaLabel="Test Drawer">
          <input
            placeholder="title"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </SlideOver>
      );
    };

    const user = userEvent.setup();
    render(<HostWithChangingOnClose />);

    const input = await screen.findByPlaceholderText('title');
    await user.type(input, 'Hello');

    expect(input).toHaveValue('Hello');
  });
});
