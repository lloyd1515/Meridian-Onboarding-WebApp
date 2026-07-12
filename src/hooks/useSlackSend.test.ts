import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSlackSend, sanitizeSlackText } from './useSlackSend';

const mockGetSlackConfigured = vi.fn();
const mockSendSlackMessage = vi.fn();

vi.mock('../services/db', async () => {
  const actual = await vi.importActual<typeof import('../services/db')>('../services/db');
  return {
    ...actual,
    getSlackConfigured: () => mockGetSlackConfigured(),
    sendSlackMessage: (msg: string) => mockSendSlackMessage(msg),
  };
});

describe('sanitizeSlackText', () => {
  it('strips @ mentions, angle brackets, pipes, and control characters', () => {
    expect(sanitizeSlackText('@here <script>|hi\x00\x1F')).toBe('here scripthi');
  });

  it('leaves plain text untouched', () => {
    expect(sanitizeSlackText('Jane Doe')).toBe('Jane Doe');
  });
});

describe('useSlackSend', () => {
  beforeEach(() => {
    mockGetSlackConfigured.mockReset();
    mockSendSlackMessage.mockReset();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads slackConfigured from getSlackConfigured on mount', async () => {
    mockGetSlackConfigured.mockResolvedValue(true);
    const { result } = renderHook(() => useSlackSend());

    await waitFor(() => expect(result.current.slackConfigured).toBe(true));
  });

  it('copies a message to the clipboard and tracks the key that was copied', async () => {
    mockGetSlackConfigured.mockResolvedValue(false);
    const { result } = renderHook(() => useSlackSend());

    let success: boolean = false;
    await act(async () => {
      success = await result.current.copyMessage('key-1', 'hello world');
    });

    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world');
    expect(result.current.copiedKey).toBe('key-1');
  });

  it('returns false and does not set copiedKey when the clipboard API is unavailable', async () => {
    mockGetSlackConfigured.mockResolvedValue(false);
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    const { result } = renderHook(() => useSlackSend());

    let success: boolean = true;
    await act(async () => {
      success = await result.current.copyMessage('key-1', 'hello world');
    });

    expect(success).toBe(false);
    expect(result.current.copiedKey).toBeNull();
  });

  it('sends a message via sendSlackMessage and tracks the key that was sent', async () => {
    mockGetSlackConfigured.mockResolvedValue(true);
    mockSendSlackMessage.mockResolvedValue(true);
    const { result } = renderHook(() => useSlackSend());

    let sent: boolean = false;
    await act(async () => {
      sent = await result.current.sendMessage('key-2', 'hi there');
    });

    expect(sent).toBe(true);
    expect(mockSendSlackMessage).toHaveBeenCalledWith('hi there');
    expect(result.current.sentKey).toBe('key-2');
  });

  it('does not set sentKey when sendSlackMessage resolves false', async () => {
    mockGetSlackConfigured.mockResolvedValue(true);
    mockSendSlackMessage.mockResolvedValue(false);
    const { result } = renderHook(() => useSlackSend());

    let sent: boolean = true;
    await act(async () => {
      sent = await result.current.sendMessage('key-3', 'hi there');
    });

    expect(sent).toBe(false);
    expect(result.current.sentKey).toBeNull();
  });
});
