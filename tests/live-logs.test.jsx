// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import LiveLogViewer from "../src/LiveLogViewer.jsx";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("streams output and closes the connection when hidden or signed out", () => {
  const sources = [];
  class Source {
    constructor(url) { this.url = url; this.events = {}; this.close = vi.fn(); sources.push(this); }
    addEventListener(name, callback) { this.events[name] = callback; }
  }
  vi.stubGlobal("EventSource", Source);
  const view = render(<LiveLogViewer url="/api/system/logs/stream" />);
  fireEvent.click(screen.getByRole("button", { name: /Live folgen/ }));
  act(() => sources[0].events.log({ data: JSON.stringify("hello logs") }));
  expect(screen.getByText("hello logs")).toBeTruthy();
  view.rerender(<LiveLogViewer enabled={false} url="/api/system/logs/stream" />);
  expect(sources[0].close).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /Live folgen/ }).disabled).toBe(true);
});
