// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ComposeCenter from "../src/ComposeCenter.jsx";

afterEach(cleanup);

const analysis = {
  readOnly: true,
  compatible: true,
  summary: { services: 2, activeServices: 2, warnings: 0, errors: 0 },
  startOrder: ["database", "web"],
  services: [
    { name: "database", active: true, image: "postgres:17", build: false, dependsOn: [], ports: [], volumes: [{ source: "data", target: "/var/lib/postgresql/data", readOnly: false }], networks: ["default"], environment: [{ name: "POSTGRES_PASSWORD", secret: true }], envFiles: [], healthcheck: true, restart: "unless-stopped", platform: "", resources: { cpus: "2", memory: "1g" } },
    { name: "web", active: true, image: "example/web:v1", build: false, dependsOn: ["database"], ports: ["8080:80"], volumes: [], networks: ["default"], environment: [], envFiles: [], healthcheck: false, restart: "", platform: "", resources: { cpus: "", memory: "" } },
  ],
  diagnostics: [],
};

describe("ComposeCenter", () => {
  test("submits a read-only Compose analysis and renders all relevant properties", async () => {
    const request = vi.fn().mockResolvedValue({ analysis });
    const onAnalysis = vi.fn();
    render(<ComposeCenter request={request} language="de" authenticated onAnalysis={onAnalysis} />);
    fireEvent.change(screen.getByPlaceholderText(/services:/), { target: { value: "services:\n  web:\n    image: example/web:v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Projekt analysieren" }));
    await waitFor(() => expect(screen.getByText(/Analyse bestanden/)).toBeTruthy());
    expect(request).toHaveBeenCalledWith("/api/compose/analyze", expect.objectContaining({ method: "POST" }));
    expect(onAnalysis).toHaveBeenCalledWith(analysis);
    expect(screen.getByText(/POSTGRES_PASSWORD/).textContent).toContain("🔒");
    expect(screen.getByText("8080:80")).toBeTruthy();
    expect(screen.getByText(/Keine Kompatibilitätsprobleme/)).toBeTruthy();
  });

  test("requires an administrator sign-in", () => {
    render(<ComposeCenter request={vi.fn()} language="de" authenticated={false} />);
    expect(screen.getByText(/macOS-Administrator anmelden/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Projekt analysieren" }).disabled).toBe(true);
  });

  test("loads a public OpenCode Compose project into the analyzer", async () => {
    const request = vi.fn().mockResolvedValue({ source: { compose: "services:\n  web:\n    image: example/web", composeName: "compose.yaml", env: "TAG=v1", envName: ".env.example", projectName: "OpenTalk / Setup", ref: "v1.0.0" } });
    render(<ComposeCenter request={request} language="de" authenticated onAnalysis={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/gitlab\.opencode\.de/), { target: { value: "https://gitlab.opencode.de/opentalk/ot-setup" } });
    fireEvent.click(screen.getByRole("button", { name: "Projekt laden" }));
    await waitFor(() => expect(screen.getByText(/OpenTalk \/ Setup · v1\.0\.0/)).toBeTruthy());
    expect(screen.getByPlaceholderText(/services:/).value).toContain("example/web");
    expect(request).toHaveBeenCalledWith("/api/compose/source", expect.objectContaining({ method: "POST" }));
  });
});
