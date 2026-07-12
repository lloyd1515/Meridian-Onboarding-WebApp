import { API_URL, customFetch, credentialsOptions } from './shared';

// Downloads the current user's first-week agenda as a real .ics file.
// A plain <a href> to this endpoint would 401 -- cookie auth here requires
// `credentials: 'include'`, which a bare anchor navigation never sends -- so
// this fetches the file as a blob and triggers the save via a temporary,
// programmatically-clicked link instead.
export const downloadAgendaIcs = async (): Promise<void> => {
  const res = await customFetch(`${API_URL}/employees/me/agenda.ics`, credentialsOptions);
  if (!res.ok) {
    throw new Error('Failed to download agenda calendar file.');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'agenda.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
