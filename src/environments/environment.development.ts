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
  apiUrl: 'http://localhost:8081',
  forecastApiUrl: 'http://localhost:8090',
  financialAgentUrl: 'http://localhost:8090',
  treasurerAssistantUrl: 'http://localhost:8100',
  stripePublishableKey: 'pk_test_51QyAl6LWllaI9swoU7TgKE2kbtF2b2D5Xjt7fgIlBbT4bhgllP7WqeXZIlDYqbucGmKBjOenMrtRYDKJmRk0jBQ500ycwZhIE3'
};
