const runtimeApiUrl = (() => {
  if (typeof window === 'undefined') {
    return 'http://localhost:8081';
  }

  const injectedApiUrl = (window as Window & { __API_URL__?: string }).__API_URL__?.trim();
  if (injectedApiUrl) {
    return injectedApiUrl.replace(/\/$/, '');
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8081';
  }

  return window.location.origin;
})();

export const environment = {
  production: false,
  apiUrl: runtimeApiUrl
};
