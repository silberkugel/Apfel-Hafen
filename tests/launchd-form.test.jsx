// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import LaunchdScheduleOptions, { emptyLaunchdDraft, launchdDraftFromService, launchdDraftIsValid, launchdDraftPayload } from "../src/LaunchdScheduleOptions.jsx";

afterEach(cleanup);

const t = (key) => key;

function Harness({ initial = emptyLaunchdDraft() }) {
  const [draft, setDraft] = useState(initial);
  return <><LaunchdScheduleOptions draft={draft} setDraft={setDraft} t={t} /><output data-testid="draft">{JSON.stringify(draft)}</output></>;
}

const currentDraft = () => JSON.parse(screen.getByTestId("draft").textContent);

describe("LaunchdScheduleOptions", () => {
  test("changes RunAtLoad, KeepAlive and StartInterval through user interaction", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: /^runAtLogin/ }));
    await user.click(screen.getByRole("checkbox", { name: /^keepRunning/ }));
    await user.click(screen.getByRole("checkbox", { name: /^startRegularly/ }));
    const interval = screen.getByRole("spinbutton", { name: "intervalSeconds" });
    await user.clear(interval);
    await user.type(interval, "600");

    expect(currentDraft()).toMatchObject({ runAtLoad: false, keepAlive: true, startIntervalEnabled: true, startInterval: "600" });
  });

  test("adds, edits and removes calendar start times", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("checkbox", { name: /^calendarStart/ }));
    expect(currentDraft().calendarIntervals).toEqual([{ weekday: "", time: "09:00" }]);

    await user.selectOptions(screen.getByRole("combobox", { name: "weekday 1" }), "1");
    fireEvent.change(screen.getByLabelText("time 1"), { target: { value: "08:30" } });
    await user.click(screen.getByRole("button", { name: /addTime/ }));
    expect(currentDraft().calendarIntervals).toEqual([
      { weekday: "1", time: "08:30" },
      { weekday: "", time: "09:00" },
    ]);

    await user.click(screen.getByRole("button", { name: "removeTime 2" }));
    expect(currentDraft().calendarIntervals).toEqual([{ weekday: "1", time: "08:30" }]);
  });

  test("prefills an edit draft and serializes it for the API", () => {
    const draft = launchdDraftFromService({
      label: "de.example.worker", program: "/usr/bin/true", programArguments: ["/usr/bin/true", "--once"],
      runAtLoad: true, keepAlive: false, startInterval: 900,
      calendarIntervals: [{ weekday: 0, hour: 7, minute: 5 }], loaded: true,
      standardOutPath: "/tmp/worker.out", standardErrorPath: "",
    });
    expect(draft).toMatchObject({ label: "de.example.worker", argumentsText: "--once", startIntervalEnabled: true, startInterval: "900", calendarIntervals: [{ weekday: "0", time: "07:05" }] });
    expect(launchdDraftIsValid(draft)).toBe(true);
    expect(launchdDraftPayload(draft)).toMatchObject({
      arguments: ["--once"], startInterval: 900,
      calendarIntervals: [{ weekday: 0, hour: 7, minute: 5 }],
    });
  });
});
