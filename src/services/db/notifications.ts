import { API_URL, customFetch, getCSRFToken, credentialsOptions } from './shared';

export const getSlackConfigured = async (): Promise<boolean> => {
  try {
    const res = await customFetch(`${API_URL}/notifications/slack/status`, credentialsOptions);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.configured);
  } catch (e) {
    console.error('Error checking Slack configuration:', e);
    return false;
  }
};

export const sendSlackMessage = async (message: string): Promise<boolean> => {
  const res = await customFetch(`${API_URL}/notifications/slack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({ message }),
    ...credentialsOptions
  });
  if (!res.ok) return false;
  const data = await res.json();
  return Boolean(data.sent);
};
