import React, { useEffect, useMemo, useRef, useState } from "react";
import { filterLogText } from "./log-filter.mjs";

export default function LiveLogViewer({ url, language = "de", title = "Logs", system = false, enabled = true }) {
  const de = language === "de";
  const [lines, setLines] = useState("");
  const [filter, setFilter] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [boot, setBoot] = useState(false);
  const [tail, setTail] = useState(200);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState("");
  const sourceRef = useRef(null);
  const outputRef = useRef(null);

  const stop = () => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setFollowing(false);
  };

  const start = () => {
    stop();
    setError("");
    const separator = url.includes("?") ? "&" : "?";
    setLines("");
    const source = new EventSource(`${url}${separator}tail=${tail}&boot=${boot ? 1 : 0}`);
    sourceRef.current = source;
    setFollowing(true);
    source.addEventListener("log", (event) => {
      if (sourceRef.current !== source) return;
      const chunk = JSON.parse(event.data);
      setLines((value) => `${value}${chunk}`.slice(-500_000));
    });
    source.addEventListener("end", () => { if (sourceRef.current === source) stop(); });
    source.addEventListener("error", (event) => {
      if (sourceRef.current !== source) return;
      setError(event.data ? JSON.parse(event.data) : (de ? "Verbindung beendet. Anmeldung prüfen und erneut starten." : "Connection ended. Check sign-in and restart."));
      stop();
    });
  };

  useEffect(() => () => sourceRef.current?.close(), []);
  useEffect(() => { stop(); }, [enabled, url, boot]);
  useEffect(() => {
    if (following && outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines, following]);

  const visible = useMemo(() => filterLogText(lines, { query: filter, since, until }), [lines, filter, since, until]);
  const snapshot = async () => {
    stop(); setError("");
    try {
      const response = await fetch(`${url.replace(/\/stream$/, "/snapshot")}?tail=${tail}&boot=${boot ? 1 : 0}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setLines(data.output);
    } catch (error) { setError(error.message); }
  };
  const validTail = Number.isInteger(Number(tail)) && Number(tail) >= 1 && Number(tail) <= 5000;
  const download = () => {
    const blob = new Blob([visible], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${title.replace(/[^a-z0-9._-]+/gi, "-").toLowerCase()}-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return <section className="live-log-viewer">
    <div className="log-toolbar">
      {!system && <><label>{de ? "Zeilen" : "Lines"}<input type="number" min="1" max="5000" value={tail} onChange={(event) => setTail(event.target.value)} /></label><label><input type="checkbox" checked={boot} onChange={(event) => setBoot(event.target.checked)} />Boot</label></>}
      <label className="log-filter">⌕<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={de ? "Ausgabe filtern" : "Filter output"} /></label>
      <button disabled={!enabled || !validTail} onClick={snapshot}>{de ? "Laden" : "Load"}</button>
      <button disabled={!enabled || !validTail} className={following ? "danger" : "primary"} onClick={following ? stop : start}>{following ? `■ ${de ? "Anhalten" : "Stop"}` : `▶ ${de ? "Live folgen" : "Follow live"}`}</button>
      <button onClick={() => setLines("")}>{de ? "Leeren" : "Clear"}</button>
      <button disabled={!visible} onClick={download}>⇩ {de ? "Exportieren" : "Export"}</button>
    </div>
    <div className="log-toolbar"><label>{de ? "Seit" : "Since"}<input type="datetime-local" value={since} onChange={(event) => setSince(event.target.value)} /></label><label>{de ? "Bis" : "Until"}<input type="datetime-local" value={until} onChange={(event) => setUntil(event.target.value)} /></label></div>
    {(since || until) && <p>{de ? "Zeitfilter zeigen nur geladene Zeilen mit erkennbarem Zeitstempel. Zeiten ohne Zeitzone gelten lokal." : "Time filters show only loaded lines with a recognizable timestamp. Times without a timezone are local."}</p>}
    {system && <p>{de ? "Systemprotokoll: letzte fünf Minuten und anschließende Live-Ausgabe." : "System log: last five minutes followed by live output."}</p>}
    {error && <div className="message error" role="alert">{error}</div>}
    <pre ref={outputRef} className="live-log-output">{visible || (de ? "Noch keine Ausgabe. Live-Folge starten." : "No output yet. Start live follow.")}</pre>
  </section>;
}
