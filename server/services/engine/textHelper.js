import {
  KNOWN_DIRECTORS,
  KNOWN_ACTORS,
  AMBIGUOUS_PERSON_MAP,
  NON_DIRECTOR_WORDS,
  NON_ACTOR_WORDS,
  REGION_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_TITLES,
  GENRE_MOOD_WORDS,
  ENGINE_LEXICON,
  COMMON_TYPOS_MAP,
  MULTI_WORD_ANCHOR_TYPOS,
  GENRE_STOPWORDS,
  themeKeywords,
} from "./constants.js";

const themeWordsSet = new Set();
Object.values(themeKeywords).forEach((entry) => {
  (entry.terms || []).forEach((term) => {
    term
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .forEach((w) => themeWordsSet.add(w));
  });
});

export const getSimilarityScore = (str1, str2) => {
  const s1 = (str1 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const s2 = (str2 || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const dp = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(null));

  for (let i = 0; i <= len1; i += 1) dp[0][i] = i;
  for (let j = 0; j <= len2; j += 1) dp[j][0] = j;

  for (let j = 1; j <= len2; j += 1) {
    for (let i = 1; i <= len1; i += 1) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[j][i] = Math.min(
        dp[j][i - 1] + 1,
        dp[j - 1][i] + 1,
        dp[j - 1][i - 1] + cost,
      );
    }
  }

  return 1 - dp[len2][len1] / Math.max(len1, len2);
};

export const normalizeInput = (rawText) => {
  if (!rawText) return "";
  return rawText
    .replace(/[^\w\s':.&!\-+]/g, " ")
    .replace(/([a-zA-Z])\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim();
};

export const getFranchiseKey = (title) => {
  return (title || "")
    .toLowerCase()
    .replace(/[:\-–—].*$/, "")
    .replace(
      /\b(part|chapter|volume|vol\.?|episode)?\s*(\d+|ii|iii|iv|v|vi|vii|viii|ix|x)\b.*$/i,
      "",
    )
    .replace(
      /\b(reloaded|revolutions|resurrections|returns|forever|rises|awakens|back in action)\b.*$/i,
      "",
    )
    .trim();
};

export const cleanAnchorQuery = (str) => {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/([a-z])\1{2,}/g, "$1")
    .replace(/[^a-z0-9\s]/g, "");
};

export const isValidAmbiguousWord = (word, contextStr = "") => {
  const w = (word || "")
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");
  if (!AMBIGUOUS_TITLES.has(w)) return true;
  if (!contextStr || typeof contextStr !== "string") return false;

  const normFull = contextStr
    .toLowerCase()
    .replace(/[?.,!]/g, "")
    .trim()
    .replace(/^(a|an|the)\s+/, "");

  if (normFull === w) return true;

  const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const triggerRx = new RegExp(
    `\\b(?:like|similar\\s+to|such\\s+as|vibes?\\s+of|shows?|series|movies?|films?|after|watch\\s+after|watched|finished|liked|loved|enjoyed)\\s+(?:the\\s+|a\\s+|an\\s+)?${escaped}\\b(?:\\s+([a-zA-Z\\-]+))?`,
    "i",
  );

  const match = contextStr.match(triggerRx);
  if (!match) return false;

  const nextWord = (match[1] || "").toLowerCase().trim();
  if (nextWord && GENRE_MOOD_WORDS.has(nextWord)) {
    return false;
  }

  return true;
};

export const isValidCtrlWord = isValidAmbiguousWord;

export const resolveFuzzyAnchorTitle = (candidateStr, contextStr = "") => {
  if (!candidateStr || typeof candidateStr !== "string") return null;
  const clean = candidateStr
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");
  if (clean.length < 2) return null;

  if (
    AMBIGUOUS_TITLES.has(clean) &&
    !isValidAmbiguousWord(clean, contextStr || candidateStr)
  ) {
    return null;
  }

  let best = null;
  let bestSim = 0;

  for (const anchor of KNOWN_ICONIC_ANCHORS) {
    const canon = anchor.canonical.trim();
    const canonClean = canon.toLowerCase().replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_TITLES.has(canonClean) &&
      !isValidAmbiguousWord(canonClean, contextStr || candidateStr)
    ) {
      continue;
    }

    const sim = Math.max(
      getSimilarityScore(candidateStr.toLowerCase(), canon.toLowerCase()),
      getSimilarityScore(clean, canonClean),
    );

    if (sim >= 0.65 && sim > bestSim) {
      bestSim = sim;
      best = { ...anchor, canonical: canon };
    }
  }
  return best;
};

export const resolveFuzzyDirector = (candidateStr) => {
  if (!candidateStr || typeof candidateStr !== "string") return null;

  const cleaned = candidateStr
    .toLowerCase()
    .trim()
    .replace(
      /\b(movies?|films?|series|shows?|cinema|works?|directed|director|by|of|who|best|top|greatest|favorite|favourite|recommend|suggest|watch|only|just|after|before|between|since|until|from|rated|rating|above|over)\b/gi,
      "",
    )
    .replace(/\b(19\d{2}|20\d{2})s?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 3 || NON_DIRECTOR_WORDS.has(cleaned)) return null;
  if (AMBIGUOUS_PERSON_MAP[cleaned]) return null;

  const tokens = cleaned
    .split(/\s+/)
    .filter(
      (t) => Boolean(t) && !NON_DIRECTOR_WORDS.has(t) && !/^\d+$/.test(t),
    );
  if (tokens.length === 0) return null;

  const filtered = tokens.join(" ");
  if (
    filtered.length < 3 ||
    NON_DIRECTOR_WORDS.has(filtered) ||
    AMBIGUOUS_PERSON_MAP[filtered]
  ) {
    return null;
  }

  let bestDir = null;
  let bestScore = 0;

  for (const dir of KNOWN_DIRECTORS) {
    const dirLower = dir.toLowerCase();
    const parts = dirLower.split(/\s+/);
    const lastName = parts[parts.length - 1];

    const simFull = getSimilarityScore(filtered, dirLower);
    let simLast = 0;
    if (tokens.length === 1 && lastName.length >= 5) {
      const s = getSimilarityScore(tokens[0], lastName);
      if (s >= 0.85) simLast = s;
    }

    let tokenScore = 0;
    if (tokens.length > 1) {
      for (const t of tokens) {
        if (
          t.length >= 5 &&
          lastName.length >= 5 &&
          !NON_DIRECTOR_WORDS.has(t)
        ) {
          const s = getSimilarityScore(t, lastName);
          if (s >= 0.85) tokenScore = Math.max(tokenScore, s);
        }
      }
      for (let i = 0; i < tokens.length - 1; i += 1) {
        const pair = `${tokens[i]} ${tokens[i + 1]}`;
        tokenScore = Math.max(tokenScore, getSimilarityScore(pair, dirLower));
      }
    }

    const score = Math.max(simFull, simLast, tokenScore);
    if (score >= 0.72 && score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  return bestDir;
};

export const resolveFuzzyActor = (candidateStr) => {
  if (!candidateStr || typeof candidateStr !== "string") return null;

  const cleaned = candidateStr
    .toLowerCase()
    .trim()
    .replace(
      /\b(movies?|films?|series|shows?|cinema|works?|starring|starred|actor|actors|actress|acting|cast|featuring|featured|played|with|by|of|for|in|who|best|top|greatest|favorite|favourite|recommend|suggest|watch|only|just|after|before|between|since|until|from|rated|rating|above|over)\b/gi,
      "",
    )
    .replace(/[?.,!'"():;]/g, " ")
    .replace(/\b(19\d{2}|20\d{2})s?\b/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length < 3 || NON_ACTOR_WORDS.has(cleaned)) return null;
  if (AMBIGUOUS_PERSON_MAP[cleaned]) return null;
  if (resolveFuzzyDirector(cleaned)) return null;

  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => Boolean(t) && !NON_ACTOR_WORDS.has(t) && !/^\d+$/.test(t));
  if (tokens.length === 0) return null;

  const filtered = tokens.join(" ");
  if (
    filtered.length < 3 ||
    NON_ACTOR_WORDS.has(filtered) ||
    AMBIGUOUS_PERSON_MAP[filtered]
  ) {
    return null;
  }

  let bestActor = null;
  let bestScore = 0;

  for (const actor of KNOWN_ACTORS) {
    const actorLower = actor.toLowerCase();
    const parts = actorLower.split(/\s+/);
    const lastName = parts[parts.length - 1].replace(/[^a-z0-9]/g, "");

    const simFull = getSimilarityScore(filtered, actorLower);
    let simLast = 0;
    if (
      tokens.length === 1 &&
      lastName.length >= 5 &&
      !NON_ACTOR_WORDS.has(lastName) &&
      !AMBIGUOUS_PERSON_MAP[lastName]
    ) {
      const s = getSimilarityScore(tokens[0], lastName);
      if (s >= 0.84) simLast = s;
    }

    let tokenScore = 0;
    if (tokens.length > 1) {
      for (const t of tokens) {
        if (
          t.length >= 5 &&
          lastName.length >= 5 &&
          !NON_ACTOR_WORDS.has(t) &&
          !AMBIGUOUS_PERSON_MAP[t]
        ) {
          const s = getSimilarityScore(t, lastName);
          if (s >= 0.86) tokenScore = Math.max(tokenScore, s);
        }
      }
      for (let i = 0; i < tokens.length - 1; i += 1) {
        const pair = `${tokens[i]} ${tokens[i + 1]}`;
        tokenScore = Math.max(tokenScore, getSimilarityScore(pair, actorLower));
      }
      if (tokens.length >= 3) {
        for (let i = 0; i < tokens.length - 2; i += 1) {
          const triple = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
          tokenScore = Math.max(
            tokenScore,
            getSimilarityScore(triple, actorLower),
          );
        }
      }
    }

    const score = Math.max(simFull, simLast, tokenScore);
    if (score >= 0.74 && score > bestScore) {
      bestScore = score;
      bestActor = actor;
    }
  }
  return bestActor;
};

const isDescriptivePhrase = (phrase) => {
  if (!phrase) return true;
  const lower = phrase.toLowerCase().trim();
  if (
    NON_ACTOR_WORDS.has(lower) ||
    GENRE_STOPWORDS.has(lower) ||
    AMBIGUOUS_PERSON_MAP[lower]
  ) {
    return true;
  }

  for (const data of Object.values(themeKeywords)) {
    if (data.terms.some((t) => lower.includes(t.toLowerCase()))) return true;
  }

  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  return words.some(
    (w) =>
      NON_ACTOR_WORDS.has(w) ||
      GENRE_STOPWORDS.has(w) ||
      ENGINE_LEXICON.includes(w) ||
      themeWordsSet.has(w) ||
      /^(a|an|the|some|any|no|lots|full|crazy|big|small|old|new|real|true|dark|light|deep|bad|good)$/.test(
        w,
      ),
  );
};

export const extractActors = (rawText, director = null) => {
  if (!rawText || typeof rawText !== "string") return [];

  const actors = [];
  const addActor = (candidate) => {
    if (!candidate || actors.length >= 3) return;
    const cleaned = candidate
      .replace(/[?.,!'"():;]/g, " ")
      .replace(
        /\b(movies?|films?|series|shows?|cinema|works?|starring|starred|actor|actors|actress|acting|cast|featuring|featured|played|with|by|of|for|in|who|best|top|greatest|favorite|favourite|recommend|suggest|watch)\b/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned || cleaned.length < 3) return;
    if (NON_ACTOR_WORDS.has(cleaned.toLowerCase())) return;
    if (GENRE_STOPWORDS.has(cleaned.toLowerCase())) return;
    if (AMBIGUOUS_PERSON_MAP[cleaned.toLowerCase()]) return;

    if (
      director &&
      (getSimilarityScore(cleaned, director) >= 0.72 ||
        resolveFuzzyDirector(cleaned) === director)
    ) {
      return;
    }
    if (resolveFuzzyDirector(cleaned)) return;
    if (resolveFuzzyAnchorTitle(cleaned, rawText)) return;

    const fuzzy = resolveFuzzyActor(cleaned);
    if (!fuzzy && isDescriptivePhrase(cleaned)) return;

    const finalName = fuzzy || cleaned;
    if (director && finalName.toLowerCase() === director.toLowerCase()) return;

    if (!actors.some((a) => a.toLowerCase() === finalName.toLowerCase())) {
      actors.push(finalName);
    }
  };

  const patterns = [
    /\b(?:starring|starred\s+by|featuring|featured\s+with|acted\s+by|actor|actress|cast\s+includes|played\s+by)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\b(?:movies?|films?|series|shows?|works?)\s+(?:starring|featuring)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\b(?:movies?|films?|series|shows?|works?)\s+(?:of|for|with|by)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\bwith\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){1,2}?)(?=[,.;!?]|\s+(?:after|before|without|from|in|above|over|rated|rating|and|or|where|about|instead)\b|$)/gi,
    /\b([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,2}?)\s+(?:movies?|films?|series|shows?|acting|filmography)\b/gi,
  ];

  for (let pIdx = 0; pIdx < patterns.length; pIdx += 1) {
    const pat = patterns[pIdx];
    let match;
    while ((match = pat.exec(rawText)) !== null) {
      const parts = match[1]
        .trim()
        .split(/\s+(?:and|or|&)\s+|\s*,\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const part of parts) {
        const fuzzy = resolveFuzzyActor(part);
        if (fuzzy) {
          addActor(fuzzy);
        } else if (pIdx <= 2) {
          const words = part.split(/\s+/).filter(Boolean);
          const validWords =
            !isDescriptivePhrase(part) &&
            words.every((w) => !REGION_MAP.some((r) => r.pattern.test(w)));
          if (words.length >= 2 && words.length <= 4 && validWords) {
            addActor(part);
          } else if (
            pIdx === 0 &&
            words.length === 1 &&
            words[0].length >= 5 &&
            validWords
          ) {
            addActor(part);
          }
        }
      }
    }
  }

  if (actors.length === 0) {
    const standalone = resolveFuzzyActor(rawText);
    if (standalone) {
      addActor(standalone);
    } else {
      const tokens = rawText
        .replace(/[^\w\s.\-']/g, " ")
        .split(/\s+/)
        .filter(
          (t) =>
            Boolean(t) &&
            !NON_ACTOR_WORDS.has(t.toLowerCase()) &&
            !/^\d+$/.test(t),
        );
      for (let i = 0; i < tokens.length; i += 1) {
        if (tokens[i].length >= 5) {
          const single = resolveFuzzyActor(tokens[i]);
          if (single) {
            addActor(single);
            break;
          }
        }
        if (i < tokens.length - 1) {
          const pair = resolveFuzzyActor(`${tokens[i]} ${tokens[i + 1]}`);
          if (pair) {
            addActor(pair);
            break;
          }
        }
        if (i < tokens.length - 2) {
          const triple = resolveFuzzyActor(
            `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`,
          );
          if (triple) {
            addActor(triple);
            break;
          }
        }
      }
    }
  }

  return actors;
};

export const normalizePromptSpelling = (rawPrompt) => {
  if (!rawPrompt || typeof rawPrompt !== "string") return "";

  let cleaned = rawPrompt.replace(/([a-zA-Z])\1{2,}/g, "$1$1");

  for (const rule of MULTI_WORD_ANCHOR_TYPOS) {
    cleaned = cleaned.replace(rule.pattern, rule.replacement);
  }

  const extraTypos = {
    reting: "rating",
    ratting: "rating",
    ratng: "rating",
    movei: "movie",
    movi: "movie",
    moive: "movie",
    movis: "movies",
    moveis: "movies",
    seris: "series",
    seires: "series",
    anme: "anime",
    anim: "anime",
    psycological: "psychological",
    psychlogical: "psychological",
    thrilr: "thriller",
    comdey: "comedy",
    romnce: "romance",
    horor: "horror",
    acton: "action",
    scfi: "scifi",
  };

  return cleaned
    .split(/\s+/)
    .map((rawToken) => {
      const clean = rawToken.toLowerCase().replace(/[^a-z0-9\-']/g, "");
      if (!clean || clean.length < 2) return rawToken;

      const directFix = COMMON_TYPOS_MAP[clean] || extraTypos[clean];
      if (directFix) {
        return rawToken.replace(new RegExp(clean, "i"), directFix);
      }

      if (ENGINE_LEXICON.includes(clean) || /^\d{2,4}s?$/.test(clean)) {
        return rawToken;
      }

      for (const anchor of KNOWN_ICONIC_ANCHORS) {
        const canon = anchor.canonical.trim();
        if (!canon.includes(" ")) {
          const canonLower = canon.toLowerCase();
          if (AMBIGUOUS_TITLES.has(canonLower)) continue;
          if (Math.abs(canonLower.length - clean.length) <= 2) {
            if (
              clean.length >= 5 &&
              getSimilarityScore(clean, canonLower) >= 0.72
            ) {
              return canon;
            }
          }
        }
      }

      let bestMatch = null;
      let bestScore = 0;

      for (const word of ENGINE_LEXICON) {
        if (Math.abs(word.length - clean.length) > 2) continue;
        const sim = getSimilarityScore(clean, word);
        if (sim > bestScore) {
          bestScore = sim;
          bestMatch = word;
        }
      }

      if (bestMatch && bestScore >= 0.72 && clean.length >= 4) {
        return rawToken.replace(new RegExp(clean, "i"), bestMatch);
      }

      return rawToken;
    })
    .join(" ");
};

export const correctTypos = normalizePromptSpelling;
