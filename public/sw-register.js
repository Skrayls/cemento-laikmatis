// The generated dist/ includes a versioned service worker; the source-only
// public/ directory can still be served for online development.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register(new URL('./sw.js', import.meta.url), {
    updateViaCache: 'none',
  }).catch((error) => {
    console.warn('Nepavyko paruošti programos darbui neprisijungus.', error);
  });
}
