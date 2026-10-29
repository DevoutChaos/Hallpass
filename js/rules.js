// Decides whether a child may leave, given the class's rules and the log.

export const openEntries = log => log.filter(e => e.backAt == null);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function lastOutAt(log, childId) {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].childId === childId) return log[i].outAt;
  }
  return null;
}

export function checkLeave(log, cls, child, now) {
  const r = cls.rules;
  const open = openEntries(log).filter(e => e.classId === cls.id);

  if (open.some(e => e.childId === child.id)) {
    return { ok: false, alreadyOut: true, message: `${child.name} is already out.` };
  }

  if (r.maxTotal != null && open.length >= r.maxTotal) {
    return {
      ok: false,
      message: r.maxTotal === 0 ? 'Nobody can go out right now.' : `${plural(r.maxTotal, 'child is', 'children are')} already out. Please wait.`,
    };
  }

  const genderRule = { M: [r.maxBoys, 'boy is', 'boys are', 'Boys'], F: [r.maxGirls, 'girl is', 'girls are', 'Girls'] }[child.gender];
  if (genderRule) {
    const [max, one, many, label] = genderRule;
    if (max != null && open.filter(e => e.gender === child.gender).length >= max) {
      return {
        ok: false,
        message: max === 0 ? `${label} can't go out right now.` : `${plural(max, one, many)} already out. Please wait.`,
      };
    }
  }

  if (r.cooldownMins > 0) {
    const last = lastOutAt(log, child.id);
    const wait = last == null ? 0 : last + r.cooldownMins * 60000 - now;
    if (wait > 0) {
      return { ok: false, message: `${child.name}, you went out recently. Try again in ${plural(Math.ceil(wait / 60000), 'minute', 'minutes')}.` };
    }
  }

  return { ok: true };
}
