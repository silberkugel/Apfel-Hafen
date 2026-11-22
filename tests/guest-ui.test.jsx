// @vitest-environment jsdom
// Benutzertests: die Oberfläche als normaler Benutzer ohne Administratorrechte.
// Erwartetes Verhalten (Server-Vertrag aus server.mjs):
// - Lesende Endpunkte liefern redigierte Daten (keine Images, Pfade, Ports, PIDs).
// - Alle Verwaltungsaktionen sind deaktiviert oder öffnen den Login-Dialog.
// - 401/500-Antworten werden als Fehlermeldung gezeigt, das Passwort wird geleert.
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "../src/main.jsx";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ADMIN_REQUIRED = "Bitte als macOS-Administrator anmelden.";
const credentials = { name: "apfel-gast", image: "nginx:1.27", status: "running" };
const gestoppt = { name: "datenbank", image: "postgres:17", status: "stopped" };

// Der Server redigiert für Gäste auf exakt diese Felder (redactContainers/redactLaunchdServices).
function jsonResponse(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function stubGuestServer({ loginResponse } = {}) {
  const fetchMock = vi.fn((url) => {
    const path = String(url);
    if (path.startsWith("/api/containers")) {
      return Promise.resolve(jsonResponse({ containers: [{ name: credentials.name, status: credentials.status }, { name: gestoppt.name, status: gestoppt.status }], refreshedAt: new Date().toISOString() }));
    }
    if (path.startsWith("/api/services/launchd")) {
      return Promise.resolve(jsonResponse({ services: [{ id: "de.apfel.gast-dienst", label: "de.apfel.gast-dienst", kind: "LaunchAgent", scope: "user", loaded: true, state: "loaded", running: true }], refreshedAt: new Date().toISOString() }));
    }
    if (path.startsWith("/api/status")) {
      return Promise.resolve(jsonResponse({ version: "0.3.8", build: "test", protocol: "HTTPS", certificateSource: "fallback" }));
    }
    if (path.startsWith("/api/auth/session")) {
      return Promise.resolve(jsonResponse({ authenticated: false }));
    }
    if (path.startsWith("/api/auth/login")) {
      return Promise.resolve(loginResponse || jsonResponse({ error: "Benutzername oder Passwort ist nicht korrekt." }, 500));
    }
    // Jede privilegierte Anfrage eines Gastes beantwortet der Server mit 401.
    return Promise.resolve(jsonResponse({ error: ADMIN_REQUIRED }, 401));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderGuest(loginResponse) {
  localStorage.setItem("cz_language", "de");
  const fetchMock = stubGuestServer({ loginResponse });
  const view = render(<App />);
  return { ...view, fetchMock };
}

describe("Benutzeroberfläche ohne Administratorrechte", () => {
  test("zeigt die Übersicht lesbar: redigierte Container, Login angeboten, Erstellen verborgen", async () => {
    const { container } = renderGuest();
    await waitFor(() => expect(screen.getByText(credentials.name)).toBeTruthy());
    expect(screen.getByText(gestoppt.name)).toBeTruthy();
    // Gast-Sicht: Login-Knopf statt Admin-Menü, kein "Container erstellen".
    expect(screen.getByRole("button", { name: /Anmelden/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Container erstellen/ })).toBeNull();
    expect(screen.queryByText(/Administration/)).toBeNull();
    // Redaktion: keine Image-Referenzen in der Liste.
    expect(container.textContent).not.toContain("nginx");
    expect(container.textContent).not.toContain("postgres");
    expect(container.textContent).not.toMatch(/PID \d+/);
  }, 10_000);

  test("hält alle Lifecycle-Aktionen für Gäste deaktiviert", async () => {
    renderGuest();
    await waitFor(() => expect(screen.getByText(credentials.name)).toBeTruthy());
    const laufend = screen.getByText(credentials.name).closest("article.row");
    const gestopptZeile = screen.getByText(gestoppt.name).closest("article.row");
    // laufender Container: Stoppen + Neustart deaktiviert; gestoppter: Starten + Neustart deaktiviert.
    expect(within(laufend).getByRole("button", { name: /Stoppen/ }).disabled).toBe(true);
    expect(within(laufend).getByRole("button", { name: /Neustart/ }).disabled).toBe(true);
    expect(within(gestopptZeile).getByRole("button", { name: /Starten/ }).disabled).toBe(true);
    expect(within(gestopptZeile).getByRole("button", { name: /Neustart/ }).disabled).toBe(true);
    // Kontextmenü: alle Einträge deaktiviert (Protokoll, Konsole, Einstellungen, Löschen …).
    fireEvent.click(within(laufend).getByRole("button", { name: /Weitere Aktionen/ }));
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.length).toBeGreaterThan(0);
    for (const item of menuItems) expect(item.disabled).toBe(true);
  }, 10_000);

  test("Info-Dialog zeigt keine technischen Details an Gäste", async () => {
    renderGuest();
    await waitFor(() => expect(screen.getByText(credentials.name)).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: /Info/ })[0]);
    const dialog = await screen.findByRole("dialog");
    const text = dialog.textContent;
    expect(text).toContain("–");           // Image/CPus/RAM durch Redaktion leer
    expect(text).toContain("Keine Volumes eingebunden.");
    expect(text).toContain("Keine Ports veröffentlicht.");
    expect(text).not.toContain("nginx");
  }, 10_000);

  test("Login-Dialog: falsche Zugangsdaten zeigen Server-Meldung und leeren nur das Passwort", async () => {
    const { container } = renderGuest();
    fireEvent.click(await screen.findByRole("button", { name: /Anmelden/ }));
    expect(screen.getByText("Administrator-Anmeldung erforderlich")).toBeTruthy();
    const formular = container.querySelector(".login-dialog");
    fireEvent.change(within(formular).getByLabelText(/Benutzername/), { target: { value: "apfel-gast" } });
    fireEvent.change(within(formular).getByLabelText(/Passwort/), { target: { value: "falsch-123" } });
    fireEvent.click(within(formular).getByRole("button", { name: /Anmelden/ }));
    await waitFor(() => expect(screen.getByText("Benutzername oder Passwort ist nicht korrekt.")).toBeTruthy());
    // Passende Reaktion: Fehler sichtbar, Passwort geleert, Benutzername bleibt, Gast-Status unverändert.
    expect(within(formular).getByLabelText(/Passwort/).value).toBe("");
    expect(within(formular).getByLabelText(/Benutzername/).value).toBe("apfel-gast");
    expect(within(container.querySelector(".account-controls")).getByRole("button", { name: /Anmelden/ })).toBeTruthy();
  }, 10_000);

  test("401-Antwort des Servers führt zurück in den abgemeldeten Zustand", async () => {
    // Session abgelaufen: der Server antwortet auf den Login mit 401 + Standardmeldung.
    const { container } = renderGuest(jsonResponse({ error: ADMIN_REQUIRED }, 401));
    fireEvent.click(await screen.findByRole("button", { name: /Anmelden/ }));
    const formular = container.querySelector(".login-dialog");
    fireEvent.change(within(formular).getByLabelText(/Benutzername/), { target: { value: "apfel-gast" } });
    fireEvent.change(within(formular).getByLabelText(/Passwort/), { target: { value: "xyz" } });
    fireEvent.click(within(formular).getByRole("button", { name: /Anmelden/ }));
    await waitFor(() => expect(within(formular).getByText(ADMIN_REQUIRED)).toBeTruthy());
    expect(within(formular).getByLabelText(/Passwort/).value).toBe("");
  }, 10_000);

  test("Technik- und Werkstatt-Bereiche bleiben für Gäste geschützt, ohne privilegierte Endpunkte abzufragen", async () => {
    const { fetchMock } = renderGuest();
    await waitFor(() => expect(screen.getByText(credentials.name)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Technik/ }));
    await waitFor(() => expect(screen.getAllByText(/Administrator-Anmeldung erforderlich/).length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /Werkstatt/ }));
    // Keine einzige Anfrage an privilegierte Endpunkte, solange kein Administrator angemeldet ist.
    const privilegiert = fetchMock.mock.calls.map(([url]) => String(url))
      .filter((url) => /\/api\/(images|administration|technology|system|stacks|operations|builder)/.test(url));
    expect(privilegiert).toEqual([]);
  }, 10_000);

  test("LaunchD-Bereich zeigt Gästen redigierte Dienste mit Nur-lesen-Kennzeichnung", async () => {
    const { container } = renderGuest();
    await waitFor(() => expect(screen.getByText(credentials.name)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /LaunchD/ }));
    await waitFor(() => expect(screen.getByText(/Nur lesen/)).toBeTruthy());
    expect(screen.getByText(/Systemweite Dienste werden in dieser Testversion nur angezeigt/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /LaunchAgent erstellen/ })).toBeNull();
    // Redaktion: keine Programm-Pfade oder PIDs in der Ansicht.
    expect(container.textContent).not.toMatch(/\/usr\/|\/Users\/|PID \d+/);
  }, 10_000);

  test("Sprachumschaltung wirkt auch auf den Gast-Zustand (DE → EN)", async () => {
    const { container } = renderGuest();
    fireEvent.click(await screen.findByRole("button", { name: /Anmelden/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /Sprache/ }), { target: { value: "en" } });
    await waitFor(() => expect(within(container.querySelector(".account-controls")).getByRole("button", { name: /Sign in/ })).toBeTruthy());
  }, 10_000);
});
