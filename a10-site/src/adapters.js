/** Replace these ports when embedding into AIAS. No authentication or production endpoints. */
export function createHttpAdapters({ baseUrl = '', fetchImpl = fetch } = {}) {
  async function request(path, options = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, options);
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.error?.message || '服務暫時無法使用，請稍後再試。');
      error.code = payload.error?.code || 'SERVICE_ERROR';
      throw error;
    }
    return payload;
  }
  const post = (path, value, signal) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal });
  return {
    config: { get: () => request('/api/config') },
    geocoder: { search: (query, { signal } = {}) => post('/api/geocode', { query }, signal) },
    coverage: { check: (selection, { signal } = {}) => post('/api/coverage', selection, signal) },
    jobs: {
      create: (selection, { signal } = {}) => post('/api/jobs', selection, signal),
      get: id => request(`/api/jobs/${encodeURIComponent(id)}`),
    },
    downloads: { get: id => request(`/api/jobs/${encodeURIComponent(id)}/download`) },
  };
}
