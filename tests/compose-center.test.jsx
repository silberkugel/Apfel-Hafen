// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ComposeCenter from "../src/ComposeCenter.jsx";

afterEach(cleanup);

const analysis = {
  readOnly: true,
  compatible: true,
  project: { name: "demo" },
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
    const request = vi.fn((url) => Promise.resolve(url === "/api/stacks" ? { stacks: [] } : { analysis }));
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
    const request = vi.fn((url) => Promise.resolve(url === "/api/stacks" ? { stacks: [] } : { source: { compose: "services:\n  web:\n    image: example/web", composeName: "compose.yaml", env: "TAG=v1", envName: ".env.example", projectName: "OpenTalk / Setup", ref: "v1.0.0" } }));
    render(<ComposeCenter request={request} language="de" authenticated onAnalysis={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/gitlab\.opencode\.de/), { target: { value: "https://gitlab.opencode.de/opentalk/ot-setup" } });
    fireEvent.click(screen.getByRole("button", { name: "Projekt laden" }));
    await waitFor(() => expect(screen.getByText(/OpenTalk \/ Setup · v1\.0\.0/)).toBeTruthy());
    expect(screen.getByPlaceholderText(/services:/).value).toContain("example/web");
    expect(request).toHaveBeenCalledWith("/api/compose/source", expect.objectContaining({ method: "POST" }));
  });

  test("creates and renders a read-only stack execution plan", async () => {
    const plan = {
      readOnly: true, ready: true, planId: "0123456789abcdef", stackName: "demo", decisions: [],
      phases: {
        networks: [{ composeName: "default", runtimeName: "demo-default" }],
        volumes: [{ composeName: "data", runtimeName: "demo-data" }],
        start: ["demo-database", "demo-web"], stop: ["demo-web", "demo-database"],
      },
    };
    const request = vi.fn((url) => {
      if (url === "/api/stacks") return Promise.resolve({ stacks: [] });
      if (url === "/api/compose/analyze") return Promise.resolve({ analysis });
      if (url === "/api/compose/plan") return Promise.resolve({ plan });
      return Promise.resolve({ plan, preflight: { readOnly: true, ready: true, planId: plan.planId, checks: { existingContainers: 1, plannedContainers: 2, publishedPorts: 1 }, conflicts: [] } });
    });
    render(<ComposeCenter request={request} language="de" authenticated onAnalysis={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/services:/), { target: { value: "services:\n  web:\n    image: example/web:v1" } });
    fireEvent.click(screen.getByRole("button", { name: "Projekt analysieren" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ausführungsplan erstellen" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Ausführungsplan erstellen" }));
    await waitFor(() => expect(screen.getByText(/Bereit für die spätere Ausführung/)).toBeTruthy());
    expect(screen.getByText(/0123456789abcdef/)).toBeTruthy();
    expect(screen.getAllByText("demo-web").length).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Auf diesem Mac vorab prüfen" }));
    await waitFor(() => expect(screen.getByText(/Keine lokalen Konflikte erkannt/)).toBeTruthy());
    expect(request).toHaveBeenLastCalledWith("/api/compose/preflight", expect.objectContaining({ method: "POST" }));
  });
});
