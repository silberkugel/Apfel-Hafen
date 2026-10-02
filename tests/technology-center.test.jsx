// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import TechnologyCenter from "../src/TechnologyCenter.jsx";

afterEach(cleanup);

const snapshot = {
  sampledAt: "2026-10-02T12:00:00.000Z",
  host: {
    memory: { usedPercent: 71, usedBytes: 12_000_000_000, totalBytes: 16_000_000_000, pressure: "normal" },
    cpu: { usedPercent: 18, loadAverage: [2.1, 2, 1.8], logicalCores: 8 },
    gpu: { available: false }, neuralEngine: { available: false },
    disk: { freeBytes: 412_000_000_000, usedPercent: 79 },
    thermal: { state: "normal", cpuTemperatureCelsius: null },
    system: { uptimeSeconds: 1_051_200, macosVersion: "27.0.1", architecture: "arm64" },
  },
  containers: {
    systemRunning: true, total: 1, running: 1, cpuPercent: 8, memoryUsageBytes: 212_000_000, memoryLimitBytes: 1_073_741_824,
    disk: { sizeBytes: 18_400_000_000, reclaimableBytes: 5_100_000_000 }, statsError: "",
    items: [{ name: "web", image: "nginx:latest", status: "running", cpus: 2, cpuPercent: 8, memoryUsageBytes: 212_000_000, memoryLimitBytes: 1_073_741_824, networkRxBytesPerSecond: 1200, networkTxBytesPerSecond: 300, blockReadBytesPerSecond: 0, blockWriteBytesPerSecond: 100, numProcesses: 6 }],
  },
  recommendations: [{ severity: "info", code: "reclaimableStorage" }],
};

describe("TechnologyCenter", () => {
  test("shows the six host tiles and Apple Container table", async () => {
    const request = vi.fn().mockResolvedValue(snapshot);
    const onSnapshot = vi.fn();
    render(<TechnologyCenter request={request} language="de" authenticated active onNotice={() => {}} onError={() => {}} onSnapshot={onSnapshot} />);
    await waitFor(() => expect(screen.getByText("71 %")).toBeTruthy());
    expect(onSnapshot).toHaveBeenCalledWith(snapshot);
    expect(screen.getByText("Memory")).toBeTruthy();
    expect(screen.getByText("GPU / ANE")).toBeTruthy();
    expect(screen.getByText("SSD")).toBeTruthy();
    expect(screen.getByText("Thermal")).toBeTruthy();
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByRole("button", { name: "web" })).toBeTruthy();
    expect(screen.getByText(/rückgewinnbar/)).toBeTruthy();
  });

  test("protects monitoring data before sign-in", () => {
    render(<TechnologyCenter request={vi.fn()} language="en" authenticated={false} active onNotice={() => {}} onError={() => {}} />);
    expect(screen.getByText(/Administrator sign-in/)).toBeTruthy();
  });

  test("keeps the last snapshot and refreshes when the tab is opened again", async () => {
    const request = vi.fn().mockResolvedValue(snapshot);
    const view = render(<TechnologyCenter request={request} language="de" authenticated active onNotice={() => {}} onError={() => {}} />);
    await waitFor(() => expect(screen.getByText("71 %")).toBeTruthy());
    view.rerender(<TechnologyCenter request={request} language="de" authenticated active={false} onNotice={() => {}} onError={() => {}} />);
    expect(screen.getByText("71 %")).toBeTruthy();
    view.rerender(<TechnologyCenter request={request} language="de" authenticated active onNotice={() => {}} onError={() => {}} />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Messwerte werden geladen/)).toBeNull();
  });
});
