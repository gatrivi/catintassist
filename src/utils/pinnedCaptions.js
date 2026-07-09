/** Stable pin matching — caption ids change on seal/split; turnId + text survive. */

const norm = (text) => (text || '').trim();

/** Build a pin row from a live caption bubble. */
export function buildPinEntry(cap) {
  if (!cap?.id || !norm(cap.text)) return null;
  return {
    id: cap.id,
    turnId: cap.turnId || null,
    text: cap.text,
    lang: cap.lang || 'en',
    pinLive: cap.isFinal === false,
  };
}

/**
 * Whether a stored pin still refers to this caption row.
 * ponytail: live pins also hide same-turn chunks split from the snapshot text.
 */
export function pinMatchesCaption(pin, cap) {
  if (!pin || !cap?.id) return false;
  if (pin.id === cap.id) return true;

  const pinText = norm(pin.text);
  const capText = norm(cap.text);
  if (!pinText || !capText || !pin.turnId || pin.turnId !== cap.turnId) return false;

  if (pinText === capText) return true;

  if (pin.pinLive && pinText.includes(capText) && capText.length >= 3) return true;

  return false;
}

/** Sync pin ids/text when caption rows are sealed, split, or updated. */
export function migratePinnedCaptions(pins, captions) {
  if (!pins?.length || !captions?.length) return pins;

  let changed = false;
  const next = pins.map((pin) => {
    const byId = captions.find((c) => c.id === pin.id);
    if (byId) {
      if (!pin.pinLive && byId.text !== pin.text) {
        changed = true;
        return { ...pin, text: byId.text, lang: byId.lang || pin.lang, turnId: byId.turnId || pin.turnId };
      }
      if (!pin.turnId && byId.turnId) {
        changed = true;
        return { ...pin, turnId: byId.turnId };
      }
      return pin;
    }

    const byMatch = captions.find((c) => pinMatchesCaption(pin, c));
    if (byMatch) {
      changed = true;
      return {
        ...pin,
        id: byMatch.id,
        turnId: byMatch.turnId || pin.turnId,
        text: pin.pinLive ? pin.text : byMatch.text,
        lang: byMatch.lang || pin.lang,
      };
    }

    return pin;
  });

  return changed ? next : pins;
}

export function isCaptionPinned(pins, cap) {
  return (pins || []).some((p) => pinMatchesCaption(p, cap));
}

export function togglePinEntry(pins, cap) {
  const prev = pins || [];
  if (isCaptionPinned(prev, cap)) {
    return prev.filter((p) => !pinMatchesCaption(p, cap));
  }
  const entry = buildPinEntry(cap);
  return entry ? [...prev, entry] : prev;
}
