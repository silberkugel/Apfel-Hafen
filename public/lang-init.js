// Runs before the app bundle to set the UI language early, so the loading hint
// is not shown in the wrong language. Kept in public/ as a same-origin classic
// script (served in both dev and the production build) so the server can send a
// strict `script-src 'self'` Content-Security-Policy without an inline script.
if (navigator.language.toLowerCase().startsWith("en")) {
  document.documentElement.lang = "en";
  const hint = document.getElementById("loading-hint");
  if (hint) {
    hint.innerHTML = "The interface is loading. If this message remains visible, the HTML file was opened directly. Double-click <strong>Start-Apfel-Hafen.command</strong> instead.";
  }
}
