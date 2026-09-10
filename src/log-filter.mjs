export function filterLogText(text, { query = "", since = "", until = "" } = {}) {
  const lower = since ? Date.parse(since) : -Infinity;
  const upper = until ? Date.parse(until) : Infinity;
  return text.split(/\r?\n/).filter((line) => {
    if (query && !line.toLowerCase().includes(query.toLowerCase())) return false;
    if (!since && !until) return true;
    const timestamp = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/);
    if (!timestamp) return false;
    const time = Date.parse(timestamp[0]);
    return time >= lower && time <= upper;
  }).join("\n");
}
