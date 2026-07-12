import { API_URL, customFetch, getCSRFToken, credentialsOptions } from './shared';

export interface Question {
  id: string;
  employeeId: string;
  employeeName: string | null;
  subject: string;
  body: string;
  status: 'open' | 'answered';
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
}

function mapQuestionToFrontend(q: any): Question {
  return {
    id: q.id,
    employeeId: q.employee_id,
    employeeName: q.employee_name,
    subject: q.subject,
    body: q.body,
    status: q.status,
    answer: q.answer,
    createdAt: q.created_at,
    answeredAt: q.answered_at,
  };
}

export const getQuestions = async (): Promise<Question[]> => {
  try {
    const res = await customFetch(`${API_URL}/questions`, credentialsOptions);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(mapQuestionToFrontend);
  } catch (e) {
    console.error('Error fetching questions:', e);
    return [];
  }
};

export const askQuestion = async (subject: string, body: string): Promise<Question> => {
  const res = await customFetch(`${API_URL}/questions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({ subject, body }),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to submit question');
  }
  return mapQuestionToFrontend(await res.json());
};

export const answerQuestion = async (questionId: string, answer: string): Promise<Question> => {
  const res = await customFetch(`${API_URL}/questions/${questionId}/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCSRFToken()
    },
    body: JSON.stringify({ answer }),
    ...credentialsOptions
  });
  if (!res.ok) {
    const detail = await res.json();
    throw new Error(detail?.detail || 'Failed to submit answer');
  }
  return mapQuestionToFrontend(await res.json());
};
