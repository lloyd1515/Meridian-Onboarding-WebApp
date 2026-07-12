import { useEffect, useRef, useState } from 'react';
import { getSlackConfigured, sendSlackMessage } from '../services/db';

// Strips characters that could be used to inject unintended Slack mentions
// (@here/@channel/@user), markup, or control sequences into a message built
// from free-text fields (names, Slack handles) before it is copied or sent.
export function sanitizeSlackText(text: string): string {
  return text.replace(/[@<|>\x00-\x1F\x7F-\x9F]/g, '');
}

interface UseSlackSendResult {
  slackConfigured: boolean;
  copiedKey: string | null;
  sendingKey: string | null;
  sentKey: string | null;
  copyMessage: (key: string, message: string) => Promise<boolean>;
  sendMessage: (key: string, message: string) => Promise<boolean>;
}

// Shared Slack copy/send behavior used by OnboardingChecklist's buddy-intro
// card and RelationshipExplorer's per-contact templates: checks whether the
// Slack webhook is configured, copies a caller-formatted message to the
// clipboard, and sends it via sendSlackMessage -- each with its own
// key so multiple instances (e.g. one per contact) can track state
// independently.
export function useSlackSend(resetDelayMs = 3000): UseSlackSendResult {
  const [slackConfigured, setSlackConfigured] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [sentKey, setSentKey] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getSlackConfigured().then(setSlackConfigured);
  }, []);

  const copyMessage = async (key: string, message: string): Promise<boolean> => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unsupported');
      }
      await navigator.clipboard.writeText(message);
      setCopiedKey(key);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedKey(null);
      }, resetDelayMs);
      return true;
    } catch (err) {
      return false;
    }
  };

  const sendMessage = async (key: string, message: string): Promise<boolean> => {
    if (sendTimeoutRef.current) {
      clearTimeout(sendTimeoutRef.current);
    }
    setSendingKey(key);
    const sent = await sendSlackMessage(message);
    setSendingKey(null);
    if (sent) {
      setSentKey(key);
      sendTimeoutRef.current = setTimeout(() => {
        setSentKey(null);
      }, resetDelayMs);
    }
    return sent;
  };

  return { slackConfigured, copiedKey, sendingKey, sentKey, copyMessage, sendMessage };
}
