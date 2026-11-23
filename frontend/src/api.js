export async function request(path, options = {}) {
  const token = sessionStorage.getItem('sop-token') || '';
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      message = typeof body.detail === 'string' ? body.detail : 'Check the entered values and try again.';
    } catch { /* The server might be offline or returning a proxy error. */ }
    if (response.status === 401) window.dispatchEvent(new Event('sop-unauthorized'));
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (options.raw) return response;
  if (options.blob) return response.blob();
  return response.json();
}

export const mutate = (path, body, method = 'POST') => request(path, { method, body: JSON.stringify(body) });
