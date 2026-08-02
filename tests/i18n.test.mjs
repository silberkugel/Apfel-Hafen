import test from "node:test";
import assert from "node:assert/strict";
import { initialLanguage, languageNames, normalizeLanguage, supportedLanguages, translate } from "../src/i18n.js";
import { localizeServerMessage, requestLanguage } from "../lib/server-i18n.mjs";

test("normalizes supported application languages", () => {
  assert.deepEqual(supportedLanguages, ["de", "en"]);
  assert.deepEqual(supportedLanguages.map((code) => languageNames[code]), ["Deutsch", "English"]);
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("de-DE"), "de");
  assert.equal(normalizeLanguage("fr-FR"), "de");
});

test("prefers a stored language and interpolates translations", () => {
  const storage = { getItem: () => "en" };
  assert.equal(initialLanguage(storage, "de-DE"), "en");
  assert.equal(translate("en", "signedInAs", { name: "Alex" }), "Signed in as Alex.");
  assert.equal(translate("de", "signedInAs", { name: "Alex" }), "Angemeldet als Alex.");
});

test("localizes API messages using the request language", () => {
  assert.equal(requestLanguage("en-GB,en;q=0.9"), "en");
  assert.equal(localizeServerMessage("Bitte als macOS-Administrator anmelden.", "en"), "Sign in as a macOS administrator.");
  assert.equal(localizeServerMessage("Bitte als macOS-Administrator anmelden.", "de"), "Bitte als macOS-Administrator anmelden.");
  assert.equal(
    localizeServerMessage("Ersetzen wurde vor dem Löschen abgebrochen: Container ist nicht mehr vorhanden.", "en"),
    "Replacement was aborted before deletion: The container no longer exists.",
  );
});
