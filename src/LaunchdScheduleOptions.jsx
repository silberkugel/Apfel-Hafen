import React from "react";

export const emptyLaunchdDraft = () => ({
  label: "", program: "", argumentsText: "", runAtLoad: true, keepAlive: false,
  startIntervalEnabled: false, startInterval: "", calendarIntervals: [], loadNow: true, standardOutPath: "", standardErrorPath: "",
});

export function launchdDraftFromService(service) {
  return {
    label: service.label,
    program: service.program,
    argumentsText: (service.programArguments || []).slice(1).join("\n"),
    runAtLoad: service.runAtLoad === true,
    keepAlive: service.keepAlive === true,
    startIntervalEnabled: Boolean(service.startInterval),
    startInterval: service.startInterval ? String(service.startInterval) : "",
    calendarIntervals: (service.calendarIntervals || []).map((entry) => ({
      weekday: entry.weekday === null ? "" : String(entry.weekday),
      time: `${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")}`,
    })),
    loadNow: service.loaded === true,
    standardOutPath: service.standardOutPath || "",
    standardErrorPath: service.standardErrorPath || "",
  };
}

export function launchdDraftPayload(draft) {
  const { argumentsText, startIntervalEnabled, ...values } = draft;
  return {
    ...values,
    arguments: argumentsText.split("\n").map((value) => value.trim()).filter(Boolean),
    startInterval: startIntervalEnabled ? Number(draft.startInterval) : null,
    calendarIntervals: draft.calendarIntervals.map((entry) => {
      const [hour, minute] = entry.time.split(":").map(Number);
      return { weekday: entry.weekday === "" ? null : Number(entry.weekday), hour, minute };
    }),
  };
}

export function launchdDraftIsValid(draft) {
  if (!draft.label.trim() || !draft.program.trim()) return false;
  if (!draft.startIntervalEnabled) return true;
  const interval = Number(draft.startInterval);
  return Number.isInteger(interval) && interval >= 1 && interval <= 31_536_000;
}

export default function LaunchdScheduleOptions({ draft, setDraft, t }) {
  const weekdays = [
    ["", t("daily")], ["1", t("monday")], ["2", t("tuesday")], ["3", t("wednesday")],
    ["4", t("thursday")], ["5", t("friday")], ["6", t("saturday")], ["0", t("sunday")],
  ];
  const updateCalendar = (index, patch) => setDraft((value) => ({ ...value, calendarIntervals: value.calendarIntervals.map((entry, itemIndex) => itemIndex === index ? { ...entry, ...patch } : entry) }));
  const removeCalendar = (index) => setDraft((value) => ({ ...value, calendarIntervals: value.calendarIntervals.filter((_, itemIndex) => itemIndex !== index) }));
  return <fieldset className="launchd-schedule"><legend>{t("scheduleOptions")}</legend><p className="schedule-combination-help">{t("scheduleCombinationHelp")}</p>
    <div className="schedule-option"><label><input type="checkbox" checked={draft.runAtLoad} onChange={(event) => setDraft((value) => ({ ...value, runAtLoad: event.target.checked }))} /><span><strong>{t("runAtLogin")}</strong><small>{t("runAtLoginHelp")}</small></span></label></div>
    <div className="schedule-option"><label><input type="checkbox" checked={draft.keepAlive} onChange={(event) => setDraft((value) => ({ ...value, keepAlive: event.target.checked }))} /><span><strong>{t("keepRunning")}</strong><small>{t("keepRunningHelp")}</small></span></label></div>
    <div className="schedule-option"><label><input type="checkbox" checked={draft.startIntervalEnabled} onChange={(event) => setDraft((value) => ({ ...value, startIntervalEnabled: event.target.checked, startInterval: event.target.checked && !value.startInterval ? "300" : value.startInterval }))} /><span><strong>{t("startRegularly")}</strong><small>{t("startRegularlyHelp")}</small></span></label>{draft.startIntervalEnabled && <div className="schedule-detail"><label><span>{t("intervalSeconds")}</span><input type="number" min="1" max="31536000" step="1" required value={draft.startInterval} onChange={(event) => setDraft((value) => ({ ...value, startInterval: event.target.value }))} /></label></div>}</div>
    <div className="schedule-option"><label><input type="checkbox" checked={draft.calendarIntervals.length > 0} onChange={(event) => setDraft((value) => ({ ...value, calendarIntervals: event.target.checked ? [{ weekday: "", time: "09:00" }] : [] }))} /><span><strong>{t("calendarStart")}</strong><small>{t("calendarStartHelp")}</small></span></label>{draft.calendarIntervals.length > 0 && <div className="calendar-times">{draft.calendarIntervals.map((entry, index) => <div className="calendar-time" key={index}><select aria-label={`${t("weekday")} ${index + 1}`} value={entry.weekday} onChange={(event) => updateCalendar(index, { weekday: event.target.value })}>{weekdays.map(([value, label]) => <option key={value || "daily"} value={value}>{label}</option>)}</select><input aria-label={`${t("time")} ${index + 1}`} type="time" required value={entry.time} onChange={(event) => updateCalendar(index, { time: event.target.value })} /><button type="button" aria-label={`${t("removeTime")} ${index + 1}`} onClick={() => removeCalendar(index)}>×</button></div>)}<button type="button" className="add-calendar-time" disabled={draft.calendarIntervals.length >= 32} onClick={() => setDraft((value) => ({ ...value, calendarIntervals: [...value.calendarIntervals, { weekday: "", time: "09:00" }] }))}>＋ {t("addTime")}</button></div>}</div>
  </fieldset>;
}
