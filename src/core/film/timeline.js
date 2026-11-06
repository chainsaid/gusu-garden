// ---------------------------------------------------------------------------
// Cut timeline: maps absolute film time to (segment index, local time). Cuts are
// durations in seconds; nothing here knows about cameras or the garden.
// ---------------------------------------------------------------------------
export function createTimeline({ cuts }) {
  if (!cuts || !cuts.length) throw new Error('createTimeline requires { cuts }');
  const starts = [];
  let total = 0;
  for (const d of cuts) { starts.push(total); total += d; }

  function sample(t) {
    const n = cuts.length;
    const time = Math.min(Math.max(t, 0), total);
    let i = 0;
    while (i < n - 1 && time >= starts[i + 1]) i++;
    return { index: i, local: Math.max(0, time - starts[i]), t: Math.min(Math.max(t, 0), total) };
  }

  return { duration: total, sample };
}
