import axios from "axios";
import {
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_TITLES,
  CTRL_MOOD_WORDS,
  themeKeywords,
  genreMap,
  TMDB_THEME_IDS,
  TMDB_GENRE_IDS,
  TMDB_ID_TO_NAME,
  ECCHI_FILTER_RX,
  KIDS_FILTER_RX,
  MODERN_WAR_RX,
  SWORD_WAR_RX,
  GORE_FILTER_RX,
} from "./engine/constants.js";
import {
  getSimilarityScore,
  cleanAnchorQuery,
  isValidCtrlWord,
  resolveFuzzyAnchorTitle,
} from "./engine/textHelper.js";

const profileCache = new Map();
const PROFILE_TTL = 30 * 60 * 1000;

const queryCache = new Map();
const QUERY_TTL = 30 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

const tmdbGet = async (url, config = {}) => {
  const rawParams = config.params || {};
  const pairs = Object.keys(rawParams)
    .filter(
      (k) =>
        k !== "api_key" && rawParams[k] !== undefined && rawParams[k] !== null,
    )
    .sort()
    .map((k) => `${k}=${rawParams[k]}`);

  const key = `${url}?${pairs.join("&")}`;

  if (queryCache.has(key)) {
    const cached = queryCache.get(key);
    if (Date.now() - cached.ts < QUERY_TTL) {
      return { data: cached.data, fromCache: true };
    }
    queryCache.delete(key);
  }

  const res = await axios.get(url, config);

  if (res && res.data) {
    if (queryCache.size >= MAX_CACHE_SIZE) {
      const oldest = queryCache.keys().next().value;
      if (oldest) queryCache.delete(oldest);
    }
    queryCache.set(key, { ts: Date.now(), data: res.data });
  }

  return res;
};

export const resolveKnownFuzzyTitle = (queryTitle, contextStr = "") => {
  if (!queryTitle) return null;
  const ctx = contextStr || queryTitle;
  const clean = queryTitle
    .toLowerCase()
    .trim()
    .replace(/^(a|an|the)\s+/, "");

  if (
    AMBIGUOUS_TITLES &&
    AMBIGUOUS_TITLES.has(clean) &&
    !isValidCtrlWord(clean, ctx)
  ) {
    return null;
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (
    tokens.length >= 2 &&
    AMBIGUOUS_TITLES &&
    AMBIGUOUS_TITLES.has(tokens[0]) &&
    tokens.slice(1).every((w) => CTRL_MOOD_WORDS.has(w))
  ) {
    return null;
  }

  const directMatch = resolveFuzzyAnchorTitle(queryTitle, ctx);
  if (directMatch) {
    const canon = directMatch.canonical
      .toLowerCase()
      .replace(/^(a|an|the)\s+/, "");
    if (
      AMBIGUOUS_TITLES &&
      AMBIGUOUS_TITLES.has(canon) &&
      !isValidCtrlWord(canon, ctx)
    ) {
      return null;
    }
    return directMatch;
  }

  const cleanQ = cleanAnchorQuery(queryTitle);
  let best = null;
  let bestSim = 0;

  for (const item of KNOWN_ICONIC_ANCHORS) {
    const canonClean = cleanAnchorQuery(item.canonical);
    const stripped = item.canonical.toLowerCase().replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_TITLES &&
      AMBIGUOUS_TITLES.has(stripped) &&
      !isValidCtrlWord(stripped, ctx)
    ) {
      continue;
    }

    const sim = getSimilarityScore(cleanQ, canonClean);
    if (sim >= 0.65 && sim > bestSim) {
      bestSim = sim;
      best = item;
    }
  }
  return best;
};

export const selectBestAnchorMatch = (
  rawResults,
  queryTitle,
  isIconic = false,
  contextStr = "",
) => {
  if (!Array.isArray(rawResults) || rawResults.length === 0) return null;

  const cleanQ = cleanAnchorQuery(queryTitle);
  const qWords = cleanQ.split(/\s+/).filter(Boolean).length;
  const meta = isIconic
    ? resolveKnownFuzzyTitle(queryTitle, contextStr) || {
        canonical: queryTitle,
      }
    : resolveKnownFuzzyTitle(queryTitle, contextStr);

  const valid = rawResults.filter(
    (r) => r.media_type !== "person" && (r.vote_count || 0) >= 10,
  );

  if (valid.length === 0) return null;

  const scored = valid.map((r) => {
    const titleClean = cleanAnchorQuery(r.title || r.name);
    const origClean = cleanAnchorQuery(r.original_title || r.original_name);
    const tWords = titleClean.split(/\s+/).filter(Boolean).length;

    let sim = Math.max(
      getSimilarityScore(cleanQ, titleClean),
      getSimilarityScore(cleanQ, origClean),
    );

    if (meta) {
      const canonClean = cleanAnchorQuery(meta.canonical);
      const canonSim = Math.max(
        getSimilarityScore(canonClean, titleClean),
        getSimilarityScore(canonClean, origClean),
      );
      sim = Math.max(sim, canonSim);
    }

    const exact = sim >= 0.95;

    if (qWords === 1 && tWords > 1 && !meta) {
      sim -= 0.35;
    } else if (tWords > qWords && !meta) {
      sim -= (tWords - qWords) * 0.2;
    }

    const popBonus = Math.min(0.25, Math.log10(r.vote_count || 1) / 15);
    return {
      ...r,
      similarity: sim,
      matchScore: sim + popBonus,
      isExactMatch: exact,
      voteCount: r.vote_count || 0,
    };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const top = scored[0];
  if (!top) return null;

  const minSim = meta ? 0.65 : 0.75;
  const hasVotes = top.isExactMatch || Boolean(meta) || top.voteCount >= 1000;
  return hasVotes && top.similarity >= minSim ? top : null;
};

export const enrichUserProfile = async (
  reviewRows = [],
  favGenres = [],
  apiKey,
  uid = null,
  reviewsCount = 0,
) => {
  const key = uid ? `user_${uid}_rev_${reviewsCount}` : null;
  if (key && profileCache.has(key)) {
    const cached = profileCache.get(key);
    if (Date.now() - cached.ts < PROFILE_TTL) {
      return cached.data;
    }
    profileCache.delete(key);
  }

  const stats = { genres: {}, keywords: {} };

  if (reviewRows.length > 0) {
    const requests = reviewRows.map((rev) => {
      const epType = rev.media_type === "anime" ? "tv" : rev.media_type;
      return tmdbGet(`https://api.themoviedb.org/3/${epType}/${rev.tmdb_id}`, {
        params: { api_key: apiKey, append_to_response: "keywords" },
      }).catch(() => null);
    });

    const responses = await Promise.all(requests);
    responses.forEach((resp, idx) => {
      if (resp && resp.data) {
        const rawR = parseFloat(reviewRows[idx].rating) || 4.5;
        const rating = rawR <= 5 ? rawR * 2 : rawR;

        if (resp.data.genres) {
          resp.data.genres.forEach((g) => {
            const gName = g.name.toLowerCase();
            stats.genres[gName] = Math.max(stats.genres[gName] || 0, rating);
            stats[gName] = stats.genres[gName];
          });
        }

        const textBlob =
          `${resp.data.title || resp.data.name || ""} ${resp.data.overview || ""}`.toLowerCase();
        const kwNames = (
          resp.data.keywords?.keywords ||
          resp.data.keywords?.results ||
          []
        ).map((k) => (k.name || "").toLowerCase());

        for (const [theme, data] of Object.entries(themeKeywords)) {
          const hit = data.terms.some(
            (t) =>
              textBlob.includes(t.toLowerCase()) ||
              kwNames.some((k) => k.includes(t.toLowerCase())),
          );
          if (hit) {
            stats.keywords[theme] = Math.max(
              stats.keywords[theme] || 0,
              rating,
            );
          }
        }
      }
    });
  }

  favGenres.forEach((row) => {
    const g = row.genre.toLowerCase();
    if (!stats.genres[g]) {
      stats.genres[g] = 8.0;
      stats[g] = 8.0;
    }
  });

  if (key) {
    profileCache.set(key, { ts: Date.now(), data: stats });
  }

  return stats;
};

export const checkPersonFallback = async (name, cleanPrompt, apiKey) => {
  const known = resolveKnownFuzzyTitle(name, cleanPrompt);
  const wordCount = name.split(/\s+/).filter(Boolean).length;

  if (!known && wordCount >= 2 && wordCount <= 4) {
    try {
      const res = await tmdbGet("https://api.themoviedb.org/3/search/person", {
        params: { api_key: apiKey, query: name, page: 1 },
      });
      const top = res.data?.results?.[0];
      if (
        top &&
        getSimilarityScore(top.name || "", name) >= 0.78 &&
        (top.known_for_department === "Acting" ||
          top.known_for_department === "Directing")
      ) {
        return top;
      }
    } catch (_) {}
  }
  return null;
};

export const resolveAnchorMedia = async (
  rawTitle,
  intent,
  cleanPrompt,
  apiKey,
) => {
  const meta = resolveKnownFuzzyTitle(rawTitle, cleanPrompt);
  const queryTitle = meta ? meta.canonical : rawTitle;

  try {
    const endpoint =
      intent.targetType === "anime" || intent.targetType === "tv"
        ? "https://api.themoviedb.org/3/search/tv"
        : intent.targetType === "movie"
          ? "https://api.themoviedb.org/3/search/movie"
          : "https://api.themoviedb.org/3/search/multi";

    const res = await tmdbGet(endpoint, {
      params: { api_key: apiKey, query: queryTitle, page: 1 },
    });

    let top = selectBestAnchorMatch(
      res.data?.results || [],
      queryTitle,
      Boolean(meta),
      cleanPrompt,
    );

    if (!top && endpoint !== "https://api.themoviedb.org/3/search/multi") {
      const multiRes = await tmdbGet(
        "https://api.themoviedb.org/3/search/multi",
        { params: { api_key: apiKey, query: queryTitle, page: 1 } },
      ).catch(() => ({ data: { results: [] } }));

      top = selectBestAnchorMatch(
        multiRes.data?.results || [],
        queryTitle,
        Boolean(meta),
        cleanPrompt,
      );
    }

    const cleanQ = cleanAnchorQuery(queryTitle);
    if (!top && cleanQ && cleanQ !== queryTitle.toLowerCase().trim()) {
      const retryRes = await tmdbGet(
        "https://api.themoviedb.org/3/search/multi",
        { params: { api_key: apiKey, query: cleanQ, page: 1 } },
      ).catch(() => ({ data: { results: [] } }));

      top = selectBestAnchorMatch(
        retryRes.data?.results || [],
        cleanQ,
        Boolean(meta),
        cleanPrompt,
      );
    }

    if (!top) {
      const stopWords = new Set([
        "the",
        "a",
        "an",
        "of",
        "and",
        "in",
        "on",
        "part",
        "chapter",
        "volume",
        "movie",
        "series",
      ]);
      const tokens = queryTitle
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(/[^\w]/g, ""))
        .filter((t) => t.length > 2 && !stopWords.has(t));

      if (tokens.length > 0) {
        tokens.sort((a, b) => b.length - a.length);
        const tokenRes = await tmdbGet(
          "https://api.themoviedb.org/3/search/multi",
          { params: { api_key: apiKey, query: tokens[0], page: 1 } },
        ).catch(() => ({ data: { results: [] } }));

        top = selectBestAnchorMatch(
          tokenRes.data?.results || [],
          tokens[0],
          Boolean(meta),
          cleanPrompt,
        );
      }
    }

    if (top) {
      return {
        title: meta ? meta.canonical : top.title || top.name,
        media: top,
        meta,
        rawInput: rawTitle,
      };
    }
    if (meta) {
      return {
        title: meta.canonical,
        media: null,
        meta,
        rawInput: rawTitle,
      };
    }
    return null;
  } catch (err) {
    console.error(`Title search failed for "${queryTitle}":`, err.message);
    return meta
      ? { title: meta.canonical, media: null, meta, rawInput: rawTitle }
      : null;
  }
};

export const fetchCandidates = async ({
  parsedIntent: intent,
  cleanPrompt,
  normalizedFocus: focus,
  resolvedAnchors: anchors = [],
  effectiveRatingFloor: ratingFloor,
  isClassicPre1980Era: isPre1980,
  isArabicOrEgyptianQuery: isArabicQuery,
  hasStrictFormats: hasFormats,
  hasPre1970Era: isPre1970,
  isStrictNoFallbackQuery: noFallback,
  tmdbApiKey: apiKey,
  getWatchedIdsFn,
  sessionSeenIds: seenIds = new Set(),
}) => {
  const sitcomRx =
    /\b(friends|the office|how i met your mother|himym|modern family|brooklyn 99|brooklyn nine-nine|new girl|parks and recreation|seinfeld|community|schitt's creek|scrubs|two and a half men|the big bang theory|big bang theory)\b/i;

  const anchorNames = anchors.map((a) => a.title);

  const isSitcomIntent =
    intent.isSitcom ||
    intent.detectedKeywords.some((k) => k.name === "sitcom") ||
    anchorNames.some((t) => sitcomRx.test(t)) ||
    /\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(cleanPrompt);

  const isDarkCom =
    intent.isDarkComedy ||
    intent.detectedKeywords.some((k) => k.name === "dark comedy") ||
    /\b(dark\s+comed(?:y|ies)|black\s+comed(?:y|ies)|morbid\s+humor|dark\s+humor)\b/i.test(
      cleanPrompt,
    );

  const excludeHero =
    intent.excludedKeywords && intent.excludedKeywords.includes("9715");

  const wantsHero =
    !excludeHero &&
    (intent.detectedKeywords.some((k) => k.name === "superhero") ||
      /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
        cleanPrompt,
      ));

  const sportKw = intent.detectedKeywords.find((k) =>
    ["racing", "boxing", "football", "basketball"].includes(k.name),
  );
  const wantsSports =
    (intent.detectedGenres.includes("sports") || !!sportKw) &&
    !intent.isUnderdog &&
    !intent.isCuteAnimeRomCom &&
    !isSitcomIntent;

  const wantsTime =
    intent.detectedKeywords.some((k) => k.name === "time travel") ||
    /\b(time travel|time loop|time-loop|timeline|timelines|wormhole)\b/i.test(
      cleanPrompt,
    );

  const wantsTwist =
    intent.detectedKeywords.some((k) => k.name === "plot twist") ||
    intent.hasTwistKeywords ||
    /\b(plot twists?|twist ending|crazy plot twists?|can'?t predict|unpredictable|mind[- ]blowing)\b/i.test(
      cleanPrompt,
    );

  const wantsMindBend =
    intent.detectedKeywords.some((k) => k.name === "mind bending") ||
    /\b(mind[- ]bending|psychological puzzle)\b/i.test(cleanPrompt);

  const wantsMagic =
    intent.detectedKeywords.some((k) => k.name === "magic") ||
    /\b(magic|magical|sorcery|sorcerer|witch|wizard|mage|alchemy)\b/i.test(
      cleanPrompt,
    );

  const wantsPsych =
    intent.isPsychologicalThriller ||
    intent.detectedKeywords.some((k) => k.name === "psychological thriller") ||
    /\b(psychological thriller|mess with my head|mindfuck|mind game)\b/i.test(
      cleanPrompt,
    );

  const isRomCom =
    !isSitcomIntent &&
    !isDarkCom &&
    (intent.isRomCom ||
      intent.detectedKeywords.some((k) => k.name === "rom-com") ||
      (/\b(sweet|light|lift my mood|feel[- ]good|rom-com|romcom|romantic comedy)\b/i.test(
        cleanPrompt,
      ) &&
        (intent.detectedGenres.includes("romance") ||
          intent.detectedGenres.includes("comedy"))));

  const isCuteAnime =
    intent.isCuteAnimeRomCom ||
    ((intent.targetType === "anime" || focus === "anime") &&
      (isRomCom ||
        (/\b(cute|wholesome|sweet|rom-com|romcom|romantic comedy)\b/i.test(
          cleanPrompt,
        ) &&
          (/\b(romance|romantic|love|rom-com|romcom)\b/i.test(cleanPrompt) ||
            /\b(funny|comedy)\b/i.test(cleanPrompt)))));

  const isDarkAnime =
    intent.isDarkAnime ||
    ((intent.targetType === "anime" || focus === "anime") &&
      /\b(dark|bleak|grim|psychological|gore|brutal|dark fantasy)\b/i.test(
        cleanPrompt,
      ));

  const isAnime =
    intent.targetType === "anime" ||
    focus === "anime" ||
    Boolean(intent.wantsExplicitAnime) ||
    isCuteAnime ||
    isDarkAnime;

  const isHaunted =
    !intent.excludeViolence &&
    !intent.excludedGenres?.includes("horror") &&
    (intent.isHauntedHorror ||
      intent.detectedKeywords.some((k) => k.name === "haunted house") ||
      /\b(cursed house|haunted house|haunted family|cursed family|scary house)\b/i.test(
        cleanPrompt,
      ) ||
      (/\b(scary|horror|haunted|cursed|creepy|demonic|evil|spooky)\b/i.test(
        cleanPrompt,
      ) &&
        /\b(house|family|home|manor|mansion|cabin)\b/i.test(cleanPrompt)));

  const isMba =
    intent.isMindBlowingAction ||
    (/\b(mind[- ]blowing|mind blowing)\b/i.test(cleanPrompt) &&
      /\baction\b/i.test(cleanPrompt));

  const isPureCom =
    !isDarkCom &&
    (intent.isPureComedy ||
      /\b(pure comedy|only comedy|strictly comedy|purely comedy|just comedy|hilarious)\b/i.test(
        cleanPrompt,
      ));

  const isSwordWar =
    intent.isSwordWarfare ||
    intent.detectedKeywords.some((k) => k.name === "sword warfare") ||
    /\b(swords?|sword fight|sword battles?|ancient sword battles?|ancient warfare|medieval warfare|old historical battles?|medieval armies|ancient battles?|gladiators?|samurai)\b/i.test(
      cleanPrompt,
    );

  if (isSwordWar) intent.isSwordWarfare = true;

  const isHistWar =
    !isSwordWar &&
    (intent.isHistoricalWar ||
      intent.detectedKeywords.some((k) => k.name === "historical war") ||
      /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war)\b/i.test(
        cleanPrompt,
      ));

  const trueCrimeKw = intent.isTrueCrimeDoc
    ? String(TMDB_THEME_IDS.trueCrime || "10714|9882|9715")
    : null;

  const isTrueCrime =
    intent.isTrueCrimeDoc ||
    intent.detectedKeywords.some((k) => k.name === "true crime") ||
    /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|crime documentary|unsolved mysteries|real crime|real crime cases)\b/i.test(
      cleanPrompt,
    );

  const isKorean =
    intent.isKorean ||
    intent.detectedLanguage === "ko" ||
    /\b(korean|k-drama|kdrama|k drama|south korea)\b/i.test(cleanPrompt);

  const isFamilyAnim =
    !isCuteAnime &&
    !isHaunted &&
    !isPureCom &&
    !isDarkCom &&
    !isSitcomIntent &&
    (intent.isFamilyAnimation ||
      (intent.detectedGenres.includes("animation") &&
        intent.detectedGenres.includes("family")) ||
      (/\b(animated|animation)\b/i.test(cleanPrompt) &&
        /\b(family|cozy|kids)\b/i.test(cleanPrompt)));

  const isCyberpunk =
    intent.isCyberpunk ||
    intent.detectedKeywords.some(
      (k) => k.name === "cyberpunk" || k.name === "dystopia",
    ) ||
    /\b(cyberpunk|cyber-punk|dystopian?|dystopia|dark futuristic|futuristic city)\b/i.test(
      cleanPrompt,
    );

  const isPhiloSciFi =
    !isCyberpunk &&
    (intent.isPhilosophicalSciFi ||
      (/\b(think about life|philosophical|existential|meaning of life|human condition)\b/i.test(
        cleanPrompt,
      ) &&
        /\b(space|universe|cosmos|sci-fi|stars)\b/i.test(cleanPrompt)));

  const isComfortCom =
    !isDarkCom &&
    (intent.isComfortComedy ||
      (intent.isTiredMood && intent.detectedGenres.includes("comedy")));

  const isHeist =
    intent.isHeistRobbery ||
    intent.detectedKeywords.some((k) => k.name === "heist") ||
    /\b(plan (?:a )?robbery|big robbery|bank robbery|robbery|heist|bank heist|big heist|steal money|caper|vault|safecracker)\b/i.test(
      cleanPrompt,
    );

  const isCrimeFam =
    intent.isCrimeFamily ||
    intent.detectedKeywords.some((k) => k.name === "crime family") ||
    /\b(crime family|mob family|mafia family|mafia empire|crime empire|building an empire|gangster empire|organized crime|gangster syndicate|drug empire|criminal empire)\b/i.test(
      cleanPrompt,
    );

  const isCrimeHeist =
    !isTrueCrime &&
    (isCrimeFam ||
      isHeist ||
      intent.isCrimeHeist ||
      intent.detectedGenres.includes("crime") ||
      intent.detectedKeywords.some(
        (k) => k.name === "organized crime" || k.name === "crime family",
      ) ||
      /\b(organized crime|mafia|gangster|mobster|mobsters|crime syndicate|underworld)\b/i.test(
        cleanPrompt,
      ));

  const isUnderdog =
    intent.isUnderdog ||
    intent.detectedKeywords.some((k) => k.name === "underdog") ||
    /\b(starting from zero|start from zero|starting from nothing|rags to riches|underdog|success story|winning against all odds|zero to hero)\b/i.test(
      cleanPrompt,
    );

  let candidates = [];
  const todayStr = new Date().toISOString().split("T")[0];
  const minNowPlayingStr = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Fetch recommendations & similar titles for anchors
  const validAnchors = anchors.filter((a) => a.media !== null);
  if (
    validAnchors.length > 0 &&
    !intent.extractedDirector &&
    (!intent.actors || intent.actors.length === 0)
  ) {
    const recRequests = validAnchors.map(async (anchor) => {
      const m = anchor.media;
      const mType = m.media_type || (m.first_air_date ? "tv" : "movie");
      const recUrl = `https://api.themoviedb.org/3/${mType}/${m.id}/recommendations`;
      const simUrl = `https://api.themoviedb.org/3/${mType}/${m.id}/similar`;

      try {
        const [recRes, simRes] = await Promise.all([
          tmdbGet(recUrl, { params: { api_key: apiKey, page: 1 } }).catch(
            () => ({ data: { results: [] } }),
          ),
          validAnchors.length > 1 || isPhiloSciFi || isMba
            ? tmdbGet(simUrl, { params: { api_key: apiKey, page: 1 } }).catch(
                () => ({ data: { results: [] } }),
              )
            : Promise.resolve({ data: { results: [] } }),
        ]);

        const merged = [
          ...(recRes.data?.results || []),
          ...(simRes.data?.results || []),
        ].filter(
          (c) =>
            (c.vote_average || 0) >= ratingFloor &&
            (c.vote_count || 0) >= 200 &&
            (c.release_date || c.first_air_date) &&
            (c.release_date || c.first_air_date) <= todayStr,
        );

        return merged.map((c) => ({
          ...c,
          anchor_source: anchor.title,
          media_type:
            intent.targetType === "anime" ? "anime" : c.media_type || mType,
        }));
      } catch (err) {
        return [];
      }
    });

    const groups = await Promise.all(recRequests);
    groups.forEach((grp) => candidates.push(...grp));

    if (intent.targetType === "anime") {
      candidates = candidates.filter((c) => c.original_language === "ja");
    }
  }

  // Director credits search
  let resolvedDirectorId = null;
  if (intent.extractedDirector) {
    try {
      const pRes = await tmdbGet("https://api.themoviedb.org/3/search/person", {
        params: { api_key: apiKey, query: intent.extractedDirector, page: 1 },
      });
      const results = pRes.data?.results || [];
      const dir =
        results.find((p) => p.known_for_department === "Directing") ||
        results[0];

      if (dir && dir.id) {
        resolvedDirectorId = dir.id;
        intent.extractedDirector = dir.name || intent.extractedDirector;

        const creditsRes = await tmdbGet(
          `https://api.themoviedb.org/3/person/${resolvedDirectorId}/combined_credits`,
          { params: { api_key: apiKey } },
        ).catch(() => ({ data: { crew: [] } }));

        const exGenreSet = new Set((intent.excludedGenreIds || []).map(Number));

        let works = (creditsRes.data?.crew || [])
          .filter((item) => {
            if (
              item.job !== "Director" ||
              (item.department && item.department !== "Directing")
            ) {
              return false;
            }

            const rel = item.release_date || item.first_air_date;
            if (!rel || rel > todayStr) return false;

            const yr = parseInt(rel.split("-")[0], 10);
            if (intent.minYear && yr < intent.minYear) return false;
            if (intent.maxYear && yr > intent.maxYear) return false;

            const gIds = item.genre_ids || [];
            if (
              exGenreSet.size > 0 &&
              gIds.some((id) => exGenreSet.has(Number(id)))
            ) {
              return false;
            }

            const mType =
              item.media_type || (item.first_air_date ? "tv" : "movie");
            if (intent.targetType === "movie" && mType !== "movie")
              return false;
            if (intent.targetType === "tv" && mType !== "tv") return false;

            const isRegionalOrOld =
              item.original_language === "ar" ||
              isArabicQuery ||
              isPre1980 ||
              yr < 1980;
            const minRating = intent.minRating
              ? intent.minRating
              : isRegionalOrOld
                ? 5.0
                : ratingFloor;

            return (item.vote_average || 0) >= minRating;
          })
          .map((item) => {
            const isAnimeItem =
              item.original_language === "ja" &&
              (item.genre_ids || []).includes(16);
            return {
              ...item,
              media_type: isAnimeItem
                ? "anime"
                : item.media_type || (item.first_air_date ? "tv" : "movie"),
            };
          });

        if (
          Array.isArray(intent.detectedGenres) &&
          intent.detectedGenres.length > 0
        ) {
          const reqGIds = new Set();
          intent.detectedGenres.forEach((g) => {
            if (TMDB_GENRE_IDS.movie[g])
              reqGIds.add(Number(TMDB_GENRE_IDS.movie[g]));
            if (TMDB_GENRE_IDS.tv[g]) reqGIds.add(Number(TMDB_GENRE_IDS.tv[g]));
          });

          if (reqGIds.size > 0) {
            works = works.filter((item) =>
              (item.genre_ids || []).some((id) => reqGIds.has(Number(id))),
            );
          }
        }

        works.sort(
          (a, b) =>
            (b.popularity || 0) * 2 +
            (b.vote_average || 0) * 10 -
            ((a.popularity || 0) * 2 + (a.vote_average || 0) * 10),
        );

        candidates = [...works];
      }
    } catch (err) {
      console.error("Director lookup failed:", err.message);
    }
  }

  // Actor credits search
  let resolvedActorIds = [];
  let resolvedActorNames = [];
  const requestedActorsList = Array.isArray(intent.actors)
    ? intent.actors
    : Array.isArray(intent.extractedActors)
      ? intent.extractedActors
      : [];
  const hasExplicitActorRequest = requestedActorsList.length > 0;

  if (hasExplicitActorRequest) {
    try {
      const actorLookups = requestedActorsList.slice(0, 3).map(async (q) => {
        const pRes = await tmdbGet(
          "https://api.themoviedb.org/3/search/person",
          { params: { api_key: apiKey, query: q, page: 1 } },
        ).catch(() => ({ data: { results: [] } }));

        const list = pRes.data?.results || [];
        const actor =
          list.find((p) => p.known_for_department === "Acting") || list[0];

        return actor && actor.id
          ? { id: actor.id, name: actor.name || q }
          : null;
      });

      const foundActors = (await Promise.all(actorLookups)).filter(Boolean);

      resolvedActorIds = foundActors.map((a) => a.id);
      resolvedActorNames = foundActors.map((a) => a.name);

      if (resolvedActorNames.length > 0) {
        intent.actors = resolvedActorNames;
        intent.extractedActors = resolvedActorNames;
        intent.extractedActor = resolvedActorNames[0];
      }

      if (foundActors.length > 0) {
        const wantsDoc =
          intent.detectedGenres.includes("documentary") || isTrueCrime;
        const wantsAnim =
          intent.detectedGenres.includes("animation") || isAnime;

        const exActorGenres = new Set([
          ...(intent.excludedGenreIds || []).map(Number),
          10767,
          10763,
          10764,
          ...(wantsDoc ? [] : [99]),
        ]);

        const creditReqs = foundActors.map((act) =>
          tmdbGet(
            `https://api.themoviedb.org/3/person/${act.id}/combined_credits`,
            { params: { api_key: apiKey } },
          )
            .then((res) => ({ act, cast: res.data?.cast || [] }))
            .catch(() => ({ act, cast: [] })),
        );

        const creditGroups = await Promise.all(creditReqs);
        let starringWorks = [];

        creditGroups.forEach(({ act, cast }) => {
          const validCast = cast
            .filter((item) => {
              const charLower = (item.character || "").toLowerCase();
              const gIds = item.genre_ids || [];

              if (
                /\b(self|himself|herself|guest|host|archive footage|uncredited|narrator|narration)\b/i.test(
                  charLower,
                )
              ) {
                return false;
              }

              if (
                !wantsAnim &&
                !gIds.includes(16) &&
                /\b(voice)\b/i.test(charLower)
              ) {
                return false;
              }

              if (typeof item.order === "number" && item.order > 18) {
                return false;
              }

              const rel = item.release_date || item.first_air_date;
              if (!rel || rel > todayStr) return false;

              const yr = parseInt(rel.split("-")[0], 10);
              if (intent.minYear && yr < intent.minYear) return false;
              if (intent.maxYear && yr > intent.maxYear) return false;

              if (gIds.some((id) => exActorGenres.has(Number(id))))
                return false;

              const mType =
                item.media_type || (item.first_air_date ? "tv" : "movie");
              if (intent.targetType === "movie" && mType !== "movie")
                return false;
              if (intent.targetType === "tv" && mType !== "tv") return false;

              const minRating = intent.minRating
                ? intent.minRating
                : item.original_language === "ar" || yr < 1980
                  ? 5.0
                  : 6.0;

              if ((item.vote_average || 0) < minRating) return false;

              if (
                item.original_language === "en" &&
                yr >= 1985 &&
                (item.vote_count || 0) < 150
              ) {
                return false;
              }

              return Boolean(item.title || item.name);
            })
            .map((item) => {
              const isAnimeItem =
                item.original_language === "ja" &&
                (item.genre_ids || []).includes(16);

              const normVote =
                !intent.minRating &&
                (item.vote_average || 0) < ratingFloor &&
                (item.vote_average || 0) >= 6.0
                  ? Math.max(item.vote_average || 6.8, ratingFloor)
                  : item.vote_average || 0;

              return {
                ...item,
                raw_vote_average: item.vote_average || 0,
                vote_average: normVote,
                media_type: isAnimeItem
                  ? "anime"
                  : item.media_type || (item.first_air_date ? "tv" : "movie"),
                cast: [{ id: act.id, name: act.name }],
                actors: [act.name],
                matched_actor: act.name,
                isActorMatch: true,
              };
            });

          starringWorks.push(...validCast);
        });

        if (foundActors.length > 1) {
          const byId = new Map();
          starringWorks.forEach((w) => {
            const prev = byId.get(w.id);
            if (prev) {
              prev.cast = [...prev.cast, ...w.cast];
              prev.actors = Array.from(new Set([...prev.actors, ...w.actors]));
              prev.sharedActorCount = (prev.sharedActorCount || 1) + 1;
            } else {
              byId.set(w.id, { ...w, sharedActorCount: 1 });
            }
          });
          const merged = Array.from(byId.values());
          const shared = merged.filter(
            (w) => w.sharedActorCount >= foundActors.length,
          );
          starringWorks = shared.length > 0 ? shared : merged;
        }

        if (
          Array.isArray(intent.detectedGenres) &&
          intent.detectedGenres.length > 0
        ) {
          const reqGIds = new Set();
          intent.detectedGenres.forEach((g) => {
            if (TMDB_GENRE_IDS.movie[g])
              reqGIds.add(Number(TMDB_GENRE_IDS.movie[g]));
            if (TMDB_GENRE_IDS.tv[g]) reqGIds.add(Number(TMDB_GENRE_IDS.tv[g]));
          });

          if (reqGIds.size > 0) {
            starringWorks = starringWorks.filter((item) =>
              (item.genre_ids || []).some((id) => reqGIds.has(Number(id))),
            );
          }
        }

        starringWorks.sort(
          (a, b) =>
            Math.log10((b.vote_count || 1) + 1) * 25 +
            (b.popularity || 0) * 1.5 +
            (b.raw_vote_average || b.vote_average || 0) * 10 -
            (Math.log10((a.vote_count || 1) + 1) * 25 +
              (a.popularity || 0) * 1.5 +
              (a.raw_vote_average || a.vote_average || 0) * 10),
        );

        if (resolvedDirectorId) {
          const dirIds = new Set(candidates.map((c) => c.id));
          candidates = starringWorks.filter((w) => dirIds.has(w.id));
        } else {
          candidates = [...starringWorks];
        }
      }
    } catch (err) {
      console.error("Actor lookup failed:", err.message);
    }
  }

  // Now playing in theaters
  if (intent.isNowPlaying) {
    try {
      const region = intent.detectedCountry || "US";
      const [np1, np2] = await Promise.all([
        tmdbGet("https://api.themoviedb.org/3/movie/now_playing", {
          params: { api_key: apiKey, page: 1, region },
        }).catch(() => ({ data: { results: [] } })),
        tmdbGet("https://api.themoviedb.org/3/movie/now_playing", {
          params: { api_key: apiKey, page: 2, region },
        }).catch(() => ({ data: { results: [] } })),
      ]);

      const nowPlaying = [
        ...(np1.data?.results || []),
        ...(np2.data?.results || []),
      ]
        .filter(
          (m) =>
            (m.vote_average || 0) >= ratingFloor &&
            (m.vote_count || 0) >= 25 &&
            m.release_date &&
            m.release_date >= minNowPlayingStr &&
            m.release_date <= todayStr,
        )
        .map((m) => ({ ...m, media_type: "movie" }));

      candidates.push(...nowPlaying);
    } catch (err) {
      console.error("Now playing fetch failed:", err.message);
    }
  }

  // Micro-theme harvesters
  if (
    isSwordWar &&
    intent.targetType !== "anime" &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !intent.isNowPlaying &&
    !intent.excludeViolence &&
    !noFallback
  ) {
    const queries = [
      "Gladiator",
      "Kingdom of Heaven",
      "Troy",
      "Braveheart",
      "The Last Samurai",
      "300",
      "The Northman",
      "The King",
    ];
    const responses = await Promise.all(
      queries.map((q) =>
        tmdbGet("https://api.themoviedb.org/3/search/movie", {
          params: { api_key: apiKey, query: q, page: 1, include_adult: false },
        }).catch(() => ({ data: { results: [] } })),
      ),
    );
    responses.forEach((res) => {
      const hit = res.data?.results?.[0];
      if (
        hit &&
        (hit.vote_average || 0) >= ratingFloor &&
        (hit.vote_count || 0) >= 200
      ) {
        candidates.push({ ...hit, media_type: "movie" });
      }
    });
  }

  if (
    isCuteAnime &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !intent.isNowPlaying &&
    !noFallback
  ) {
    const queries = [
      "Kaguya-sama: Love Is War",
      "Horimiya",
      "Kimi ni Todoke",
      "Toradora!",
      "The Dangers in My Heart",
      "Komi Can't Communicate",
      "Fruits Basket",
      "Skip and Loafer",
      "My Love Story!!",
      "Tsuki ga Kirei",
    ];
    const responses = await Promise.all(
      queries.map((q) =>
        tmdbGet("https://api.themoviedb.org/3/search/tv", {
          params: { api_key: apiKey, query: q, page: 1, include_adult: false },
        }).catch(() => ({ data: { results: [] } })),
      ),
    );
    responses.forEach((res) => {
      if (res.data?.results) {
        const hits = res.data.results
          .filter(
            (it) =>
              it.original_language === "ja" &&
              (it.genre_ids?.includes(16) || it.genre_ids?.includes(35)) &&
              (it.vote_average || 0) >= ratingFloor,
          )
          .slice(0, 2)
          .map((it) => ({ ...it, media_type: "anime" }));
        candidates.push(...hits);
      }
    });
  }

  if (
    isDarkAnime &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !intent.isNowPlaying &&
    !intent.excludeViolence &&
    !noFallback
  ) {
    const queries = [
      "Attack on Titan",
      "Death Note",
      "Monster",
      "Vinland Saga",
      "Psycho-Pass",
      "Parasyte -the maxim-",
      "Chainsaw Man",
      "Tokyo Ghoul",
      "Dororo",
      "Made in Abyss",
    ];
    const responses = await Promise.all(
      queries.map((q) =>
        tmdbGet("https://api.themoviedb.org/3/search/tv", {
          params: { api_key: apiKey, query: q, page: 1, include_adult: false },
        }).catch(() => ({ data: { results: [] } })),
      ),
    );
    responses.forEach((res) => {
      if (res.data?.results) {
        const hits = res.data.results
          .filter(
            (it) =>
              it.original_language === "ja" &&
              (it.genre_ids?.includes(16) || it.genre_ids?.includes(10765)) &&
              !it.genre_ids?.includes(10762) &&
              (it.vote_average || 0) >= ratingFloor,
          )
          .slice(0, 2)
          .map((it) => ({ ...it, media_type: "anime" }));
        candidates.push(...hits);
      }
    });
  }

  if (
    isDarkCom &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !intent.isNowPlaying &&
    !noFallback
  ) {
    const queries = [
      "In Bruges",
      "Fargo",
      "The Menu",
      "Parasite",
      "Jojo Rabbit",
      "Three Billboards Outside Ebbing, Missouri",
      "The Banshees of Inisherin",
      "Knives Out",
      "The Death of Stalin",
      "Snatch",
    ];
    const responses = await Promise.all(
      queries.map((q) =>
        tmdbGet("https://api.themoviedb.org/3/search/movie", {
          params: { api_key: apiKey, query: q, page: 1, include_adult: false },
        }).catch(() => ({ data: { results: [] } })),
      ),
    );
    responses.forEach((res) => {
      const hit = res.data?.results?.[0];
      if (hit && (hit.vote_average || 0) >= ratingFloor) {
        candidates.push({ ...hit, media_type: "movie" });
      }
    });
  }

  if (
    wantsTime &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !intent.isNowPlaying &&
    !noFallback
  ) {
    const queries = [
      "Edge of Tomorrow",
      "Source Code",
      "Looper",
      "Predestination",
      "Back to the Future",
      "Twelve Monkeys",
      "Palm Springs",
      "Groundhog Day",
      "Tenet",
    ];
    const responses = await Promise.all(
      queries.map((q) =>
        tmdbGet("https://api.themoviedb.org/3/search/movie", {
          params: { api_key: apiKey, query: q, page: 1, include_adult: false },
        }).catch(() => ({ data: { results: [] } })),
      ),
    );
    responses.forEach((res) => {
      const hit = res.data?.results?.[0];
      if (hit && (hit.vote_average || 0) >= ratingFloor) {
        candidates.push({ ...hit, media_type: "movie" });
      }
    });
  }

  const excludeHeroKw =
    excludeHero || (!wantsHero && resolvedActorIds.length === 0)
      ? "9715"
      : null;
  const heroKw = wantsHero ? "9715" : null;

  let sportsKw = null;
  if (sportKw && TMDB_THEME_IDS[sportKw.name]) {
    sportsKw = String(TMDB_THEME_IDS[sportKw.name]);
  } else if (wantsSports) {
    sportsKw = String(TMDB_THEME_IDS.sports || 6075);
  }

  const complexKws = [];
  if (wantsTime) complexKws.push(String(TMDB_THEME_IDS.timeTravel));
  if (wantsTwist) complexKws.push(String(TMDB_THEME_IDS.plotTwist));
  if (wantsMindBend) complexKws.push(String(TMDB_THEME_IDS.mindBending));
  const complexKw = complexKws.length > 0 ? complexKws.join("|") : null;

  const heistKw = isHeist
    ? String(TMDB_THEME_IDS.heist || "10051|6492|10292")
    : null;
  const crimeFamKw = isCrimeFam
    ? String(TMDB_THEME_IDS.crimeFamily || "10391|242|10051|9882")
    : null;
  const crimeHeistKw = isCrimeHeist
    ? String(TMDB_THEME_IDS.crimeHeist || "10051|6492|10292|10391|242")
    : null;
  const psychKw = wantsPsych
    ? String(TMDB_THEME_IDS.psychologicalThriller || "10714|12565|9663")
    : null;
  const darkComKw = isDarkCom ? "9716" : null;
  const romcomKw = isRomCom
    ? String(TMDB_THEME_IDS.romcom || "9799|158718|3133")
    : null;
  const swordKw =
    isSwordWar && !intent.excludeViolence
      ? String(TMDB_THEME_IDS.swordWarfare || "804|195779|2964")
      : null;
  const histWarKw =
    isHistWar && !intent.excludeViolence
      ? String(TMDB_THEME_IDS.historicalWar || "11162|233|210103")
      : null;
  const cyberpunkKw = isCyberpunk
    ? String(TMDB_THEME_IDS.cyberpunk || "12190|4565|2853|156395")
    : null;
  const philoSciFiKw = isPhiloSciFi
    ? String(TMDB_THEME_IDS.philosophicalSciFi || "10090|310|156395")
    : null;
  const underdogKw = isUnderdog
    ? String(TMDB_THEME_IDS.underdog || "9882|10714|1803")
    : null;
  const cuteAnimeKw = isCuteAnime
    ? String(TMDB_THEME_IDS.cuteAnimeRomCom || "9799|9840|158718")
    : null;
  const darkAnimeKw = isDarkAnime
    ? String(TMDB_THEME_IDS.darkAnime || "265|10714|9663|10085|210024")
    : null;
  const hauntedKw = isHaunted
    ? String(TMDB_THEME_IDS.hauntedHouse || "3358|10292|9715|9663")
    : null;
  const mbaKw = isMba
    ? String(TMDB_THEME_IDS.mindBlowingAction || "11162|9882|310|9663|12565")
    : null;
  const pureComKw = isPureCom
    ? String(TMDB_THEME_IDS.pureComedy || "9714|9713|10244|207317")
    : null;

  const formatKws = [];
  if (
    Array.isArray(intent.strictFormats) &&
    intent.strictFormats.includes("silent")
  ) {
    formatKws.push("154802");
  }
  if (
    Array.isArray(intent.strictFormats) &&
    intent.strictFormats.includes("black and white")
  ) {
    formatKws.push("10183");
  }
  const formatKw = formatKws.length > 0 ? formatKws.join(",") : null;

  const wantsSciFi =
    intent.detectedGenres.includes("scifi") ||
    wantsTime ||
    isCyberpunk ||
    isPhiloSciFi ||
    isMba;

  const isSciFiOnly =
    wantsSciFi && !intent.detectedGenres.includes("fantasy") && !wantsMagic;

  const tvFantasyExclude = isSciFiOnly
    ? "2343,33443,9799,12564,4152,12554,9663"
    : null;

  let exMovieGenres = [];
  if (intent.excludedGenres && intent.excludedGenres.length > 0) {
    intent.excludedGenres.forEach((exG) => {
      if (isSwordWar && exG === "war") return;
      if (TMDB_GENRE_IDS.movie[exG]) {
        exMovieGenres.push(String(TMDB_GENRE_IDS.movie[exG]));
      }
    });
  }

  if (intent.excludeViolence) exMovieGenres.push("27");

  if (!wantsSciFi && (wantsSports || isHistWar || isSwordWar)) {
    exMovieGenres.push("878", "16", "35", "80");
  } else if (isHaunted) {
    exMovieGenres.push("10751", "10762", "35", "16");
  } else if (isSitcomIntent) {
    exMovieGenres.push(
      "27",
      "80",
      "9648",
      "53",
      "18",
      "10752",
      "36",
      "99",
      "16",
    );
  } else if (isDarkCom) {
    exMovieGenres.push("10751", "10762", "16", "99", "10402");
  } else if (isPureCom) {
    exMovieGenres.push(
      "28",
      "53",
      "80",
      "10749",
      "18",
      "10751",
      "10762",
      "16",
      "878",
      "14",
      "10752",
      "99",
      "27",
      "9648",
    );
  } else if (isMba) {
    exMovieGenres.push("10751", "10762", "35");
  } else if (intent.isHorrorNight) {
    exMovieGenres.push("35", "16");
  } else if (isHeist) {
    exMovieGenres.push("878", "14", "16", "27");
  } else if (isCrimeFam) {
    exMovieGenres.push("10751", "10762", "16", "878", "14");
  } else if (isCrimeHeist) {
    if (!wantsSciFi) exMovieGenres.push("878");
    exMovieGenres.push("16", "14");
  } else if (isRomCom) {
    exMovieGenres.push("10752", "36", "27", "16");
  } else if (isFamilyAnim) {
    exMovieGenres.push("27", "80", "53");
  } else if (intent.detectedGenres.includes("family")) {
    exMovieGenres.push("27", "80", "53", "10752", "36", "99");
  } else if (isTrueCrime) {
    exMovieGenres.push("16", "878", "14", "35");
  } else if (isCyberpunk) {
    exMovieGenres.push("10751", "35");
  } else if (isPhiloSciFi) {
    exMovieGenres.push("35");
  } else if (isComfortCom) {
    exMovieGenres.push(
      "18",
      "10752",
      "36",
      "27",
      "80",
      "9648",
      "53",
      "99",
      "14",
      "16",
    );
  } else if (isUnderdog) {
    exMovieGenres.push("27", "14", "16");
  } else if (wantsPsych) {
    exMovieGenres.push("35");
  } else if (wantsSciFi) {
    exMovieGenres.push("14");
  } else {
    exMovieGenres.push("16");
  }

  exMovieGenres = Array.from(new Set(exMovieGenres));
  const movieWithoutGenres = exMovieGenres.join(",");

  let withoutKws = [];
  if (excludeHeroKw) withoutKws.push(excludeHeroKw);
  if (isDarkCom) withoutKws.push("9714");
  if (!isDarkCom && (isRomCom || (isComfortCom && !isPureCom))) {
    withoutKws.push("9716");
  }
  if (isFamilyAnim && !/\banime\b/i.test(cleanPrompt)) {
    withoutKws.push("210024");
  }
  if (isCuteAnime || intent.targetType === "anime" || focus === "anime") {
    withoutKws.push("2858", "190370", "9716");
  }
  if (isSitcomIntent) {
    withoutKws.push("6075", "9937", "11100");
  }
  if (intent.excludeViolence) {
    withoutKws.push("10292", "12339", "14760");
  }
  if (intent.excludedKeywords && intent.excludedKeywords.length > 0) {
    withoutKws.push(...intent.excludedKeywords);
  }
  withoutKws = Array.from(new Set(withoutKws));
  const withoutKwStr = withoutKws.length > 0 ? withoutKws.join(",") : null;

  const animeAntiEcchi = Array.from(
    new Set(["2858", "190370", "9716", ...withoutKws]),
  ).join(",");

  const movieGenres = [];
  intent.detectedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.movie[g]) movieGenres.push(TMDB_GENRE_IDS.movie[g]);
  });

  if ((isCrimeHeist || isHeist || isCrimeFam) && !movieGenres.includes(80)) {
    movieGenres.unshift(80);
  }
  if (wantsPsych && !movieGenres.includes(53) && !movieGenres.includes(9648)) {
    movieGenres.unshift(53);
  }
  if (
    (wantsTime || isCyberpunk || isPhiloSciFi || isMba || wantsSciFi) &&
    !movieGenres.includes(878)
  ) {
    movieGenres.unshift(878);
  }
  if (isUnderdog && !movieGenres.includes(18)) movieGenres.unshift(18);
  if (isHaunted && !movieGenres.includes(27)) movieGenres.unshift(27);
  if (isMba && !movieGenres.includes(28)) movieGenres.unshift(28);
  if ((isPureCom || isDarkCom) && !movieGenres.includes(35)) {
    movieGenres.unshift(35);
  }

  const tvGenres = [];
  intent.detectedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.tv[g]) tvGenres.push(TMDB_GENRE_IDS.tv[g]);
  });
  if ((isCrimeHeist || isHeist || isCrimeFam) && !tvGenres.includes(80)) {
    tvGenres.unshift(80);
  }
  if (wantsPsych && !tvGenres.includes(9648)) tvGenres.unshift(9648);
  if (
    (wantsTime || isCyberpunk || isPhiloSciFi || isMba || wantsSciFi) &&
    !tvGenres.includes(10765)
  ) {
    tvGenres.unshift(10765);
  }

  if (isKorean) {
    if (!tvGenres.includes(9648)) tvGenres.push(9648);
    if (!tvGenres.includes(80)) tvGenres.push(80);
    if ((wantsPlotTwist || intent.hasTwistKeywords) && !tvGenres.includes(18)) {
      tvGenres.push(18);
    }
  }

  const usePipe = Boolean(
    intent.excludeViolence ||
    (intent.excludedGenres && intent.excludedGenres.length > 0) ||
    isPre1980 ||
    isArabicQuery ||
    movieGenres.length >= 2,
  );
  let primaryMovieG =
    movieGenres.length > 0 ? movieGenres.join(usePipe ? "|" : ",") : null;
  let primaryTvG = tvGenres.length > 0 ? tvGenres.join("|") : null;

  if (wantsSciFi) {
    primaryMovieG = isMba ? "28,878" : "878";
    primaryTvG = "10765";
  }
  if (isComfortCom || isPureCom || isSitcomIntent || isDarkCom) {
    primaryMovieG = "35";
    primaryTvG = "35";
  }
  if (isRomCom) primaryMovieG = "35,10749";

  if (isSwordWar) {
    primaryMovieG = intent.excludeViolence ? "36|12|10751" : "36|10752";
    primaryTvG = "10768|36";
  } else if (isHistWar) {
    primaryMovieG = intent.excludeViolence ? "36|18" : "10752|36";
    primaryTvG = "10768|36";
  }

  if (isTrueCrime) {
    primaryMovieG = "99";
    primaryTvG = "99";
  }
  if (isFamilyAnim) {
    primaryMovieG = "16,10751";
    primaryTvG = "16,10751";
  } else if (intent.detectedGenres.includes("family")) {
    primaryMovieG = "10751";
    primaryTvG = "10751";
  }
  if (isUnderdog) primaryMovieG = "18";
  if (isCrimeFam) {
    primaryMovieG = "80";
    primaryTvG = "80|18";
  }
  if (isCuteAnime) primaryTvG = "35,10749,16";
  if (isHaunted) {
    primaryMovieG = "27";
    primaryTvG = "27";
  }
  if (isMba) {
    primaryMovieG = "28,878";
    primaryTvG = "10759,10765";
  }

  const isRegional = Boolean(
    (intent.detectedLanguage && intent.detectedLanguage !== "en") ||
    (intent.detectedCountry && !["US", "GB"].includes(intent.detectedCountry)),
  );

  const tightConstraints = Boolean(
    intent.minYear !== null ||
    intent.maxYear !== null ||
    intent.minRating !== null ||
    Boolean(intent.extractedDirector) ||
    resolvedActorIds.length > 0 ||
    Boolean(intent.isNowPlaying) ||
    Boolean(intent.isHyperSpecific) ||
    Boolean(intent.excludeViolence) ||
    hasFormats ||
    isRegional ||
    (intent.excludedGenres && intent.excludedGenres.length > 0) ||
    isDarkCom ||
    wantsTime ||
    isHaunted ||
    isHeist ||
    isCrimeFam ||
    isCrimeHeist ||
    Boolean(sportsKw) ||
    intent.detectedLanguage ||
    intent.detectedCountry,
  );

  const movieMinVotes =
    isPre1980 || isArabicQuery
      ? 3
      : intent.isNowPlaying
        ? 25
        : isRegional || hasFormats
          ? 20
          : tightConstraints
            ? 50
            : 300;
  const tvMinVotes =
    isPre1980 || isArabicQuery
      ? 3
      : isRegional || hasFormats
        ? 20
        : tightConstraints
          ? 40
          : 200;

  const minDateStr = intent.isNowPlaying
    ? minNowPlayingStr
    : intent.minYear
      ? `${intent.minYear}-01-01`
      : null;

  const rawMaxDateStr = intent.isNowPlaying
    ? todayStr
    : intent.maxYear
      ? `${intent.maxYear}-12-31`
      : todayStr;
  const maxDateStr = rawMaxDateStr < todayStr ? rawMaxDateStr : todayStr;

  const pickWithKeyword = () =>
    formatKw ||
    heroKw ||
    darkComKw ||
    pureComKw ||
    mbaKw ||
    hauntedKw ||
    crimeFamKw ||
    trueCrimeKw ||
    underdogKw ||
    heistKw ||
    cyberpunkKw ||
    philoSciFiKw ||
    swordKw ||
    histWarKw ||
    romcomKw ||
    psychKw ||
    crimeHeistKw ||
    (complexKw && (wantsTime || !wantsSciFi) ? complexKw : null) ||
    sportsKw ||
    null;

  // Discover endpoints (skipped when actor or director is requested)
  if (!resolvedDirectorId && !hasExplicitActorRequest) {
    if (intent.targetType === "mixed" && !intent.isNowPlaying) {
      const movieParams = {
        api_key: apiKey,
        page: 1,
        "vote_count.gte": movieMinVotes,
        "vote_average.gte": ratingFloor,
        sort_by: "popularity.desc",
        without_genres: movieWithoutGenres,
        "primary_release_date.lte": maxDateStr,
      };

      if (intent.excludeViolence && !isRegional) {
        movieParams.certification_country = "US";
        movieParams["certification.lte"] = "PG-13";
      }
      if (minDateStr) movieParams["primary_release_date.gte"] = minDateStr;
      if (intent.detectedLanguage)
        movieParams.with_original_language = intent.detectedLanguage;
      if (intent.detectedCountry)
        movieParams.with_origin_country = intent.detectedCountry;
      if (primaryMovieG) movieParams.with_genres = primaryMovieG;

      const mKw = pickWithKeyword();
      if (mKw) movieParams.with_keywords = mKw;
      if (withoutKwStr) movieParams.without_keywords = withoutKwStr;

      const tvExIds = [];
      if (intent.excludedGenres && intent.excludedGenres.length > 0) {
        intent.excludedGenres.forEach((exG) => {
          if (isSwordWar && exG === "war") return;
          if (TMDB_GENRE_IDS.tv[exG])
            tvExIds.push(String(TMDB_GENRE_IDS.tv[exG]));
        });
      }
      if (intent.excludeViolence) tvExIds.push("27");
      if (intent.excludedGenres.includes("comedy")) tvExIds.push("35");

      const baseTvWithout = isFamilyAnim
        ? ["27", "53", "80"]
        : isSitcomIntent
          ? [
              "18",
              "16",
              "10765",
              "10768",
              "10762",
              "10766",
              "27",
              "80",
              "9648",
              "53",
            ]
          : isComfortCom || isPureCom
            ? ["18", "16", "10765", "10768", "10762", "27", "80", "9648", "53"]
            : isCrimeFam || isHaunted
              ? ["10751", "10762", "16"]
              : ["16", "10767", "10763", "10764"];

      const tvParams = {
        api_key: apiKey,
        page: 1,
        "vote_count.gte": tvMinVotes,
        "vote_average.gte": ratingFloor,
        sort_by: "popularity.desc",
        without_genres: Array.from(
          new Set([...baseTvWithout, ...tvExIds]),
        ).join(","),
        "first_air_date.lte": maxDateStr,
      };

      if (minDateStr) tvParams["first_air_date.gte"] = minDateStr;
      if (intent.detectedLanguage)
        tvParams.with_original_language = intent.detectedLanguage;
      if (intent.detectedCountry)
        tvParams.with_origin_country = intent.detectedCountry;
      if (primaryTvG) tvParams.with_genres = primaryTvG;

      const tKw = pickWithKeyword();
      if (tKw && tKw !== swordKw) tvParams.with_keywords = tKw;
      if (tvFantasyExclude) tvParams.without_keywords = tvFantasyExclude;

      const animeWithout = ["10762"];
      if (intent.excludeViolence) animeWithout.push("27");
      if (intent.excludedGenres.includes("comedy")) animeWithout.push("35");
      if (intent.excludedGenres.includes("family")) animeWithout.push("10751");

      const animeParams = {
        api_key: apiKey,
        page: 1,
        "vote_count.gte": 80,
        "vote_average.gte": ratingFloor,
        sort_by: "popularity.desc",
        with_original_language: "ja",
        with_genres:
          isCuteAnime || isRomCom
            ? "35,10749,16"
            : wantsMagic
              ? "10765,16"
              : primaryTvG
                ? `${primaryTvG},16`
                : "16",
        without_keywords: animeAntiEcchi,
        without_genres: Array.from(new Set(animeWithout)).join(","),
        "first_air_date.lte": maxDateStr,
      };

      if (minDateStr) animeParams["first_air_date.gte"] = minDateStr;
      if (formatKw) animeParams.with_keywords = formatKw;
      else if (cuteAnimeKw) animeParams.with_keywords = cuteAnimeKw;
      else if (darkAnimeKw) animeParams.with_keywords = darkAnimeKw;
      else if (wantsMagic) animeParams.with_keywords = "2343|9799";
      else if (cyberpunkKw) animeParams.with_keywords = cyberpunkKw;
      else if (complexKw && (wantsTime || !wantsSciFi))
        animeParams.with_keywords = complexKw;
      else if (sportsKw) animeParams.with_keywords = sportsKw;

      if (tvFantasyExclude && !wantsMagic) {
        animeParams.without_keywords = `${animeAntiEcchi},${tvFantasyExclude}`;
      }

      const skipAnime =
        isComfortCom ||
        isHaunted ||
        isPureCom ||
        isDarkCom ||
        isSitcomIntent ||
        isSwordWar ||
        hasFormats ||
        intent.isLiveAction ||
        (intent.detectedLanguage && intent.detectedLanguage !== "ja");

      const [moviePages, tvPages, animeRes] = await Promise.all([
        Promise.all([
          tmdbGet("https://api.themoviedb.org/3/discover/movie", {
            params: { ...movieParams, page: 1 },
          }).catch(() => ({ data: { results: [] } })),
          tmdbGet("https://api.themoviedb.org/3/discover/movie", {
            params: { ...movieParams, page: 2 },
          }).catch(() => ({ data: { results: [] } })),
        ]),
        Promise.all([
          tmdbGet("https://api.themoviedb.org/3/discover/tv", {
            params: { ...tvParams, page: 1 },
          }).catch(() => ({ data: { results: [] } })),
          tmdbGet("https://api.themoviedb.org/3/discover/tv", {
            params: { ...tvParams, page: 2 },
          }).catch(() => ({ data: { results: [] } })),
        ]),
        skipAnime
          ? Promise.resolve({ data: { results: [] } })
          : tmdbGet("https://api.themoviedb.org/3/discover/tv", {
              params: animeParams,
            }).catch(() => ({ data: { results: [] } })),
      ]);

      moviePages.forEach((r) => {
        if (r.data?.results) {
          candidates.push(
            ...r.data.results.map((m) => ({
              ...m,
              media_type: "movie",
              matched_strict_format: Boolean(formatKw),
            })),
          );
        }
      });

      tvPages.forEach((r) => {
        if (r.data?.results) {
          candidates.push(
            ...r.data.results.map((t) => ({
              ...t,
              media_type: "tv",
              matched_strict_format: Boolean(formatKw),
            })),
          );
        }
      });

      const animes = (animeRes.data?.results || []).map((a) => ({
        ...a,
        media_type: "anime",
        matched_strict_format: Boolean(formatKw),
      }));

      candidates.push(...animes);
    } else if (intent.targetType === "anime" && !intent.isNowPlaying) {
      const animeWithout = ["10762"];
      if (intent.excludeViolence) animeWithout.push("27");
      if (intent.excludedGenres.includes("comedy")) animeWithout.push("35");
      if (intent.excludedGenres.includes("family")) animeWithout.push("10751");

      const animeParams = {
        api_key: apiKey,
        page: 1,
        "vote_count.gte": 80,
        "vote_average.gte": ratingFloor,
        sort_by: "popularity.desc",
        with_original_language: "ja",
        with_genres:
          isCuteAnime || isRomCom
            ? "35,10749,16"
            : wantsMagic
              ? "10765,16"
              : primaryTvG
                ? `${primaryTvG},16`
                : "16",
        without_keywords: animeAntiEcchi,
        without_genres: Array.from(new Set(animeWithout)).join(","),
        "first_air_date.lte": maxDateStr,
      };

      if (minDateStr) animeParams["first_air_date.gte"] = minDateStr;
      if (formatKw) animeParams.with_keywords = formatKw;
      else if (cuteAnimeKw) animeParams.with_keywords = cuteAnimeKw;
      else if (darkAnimeKw) animeParams.with_keywords = darkAnimeKw;
      else if (wantsMagic) animeParams.with_keywords = "2343|9799";
      else if (cyberpunkKw) animeParams.with_keywords = cyberpunkKw;
      else if (complexKw && (wantsTime || !wantsSciFi))
        animeParams.with_keywords = complexKw;
      else if (sportsKw) animeParams.with_keywords = sportsKw;

      if (tvFantasyExclude && !wantsMagic) {
        animeParams.without_keywords = `${animeAntiEcchi},${tvFantasyExclude}`;
      }

      const tvRes = await tmdbGet("https://api.themoviedb.org/3/discover/tv", {
        params: animeParams,
      });
      candidates.push(
        ...(tvRes.data.results || []).map((a) => ({
          ...a,
          media_type: "anime",
          matched_strict_format: Boolean(formatKw),
        })),
      );
    } else {
      const isTv = intent.targetType === "tv" && !intent.isNowPlaying;
      const endpoint = isTv
        ? "https://api.themoviedb.org/3/discover/tv"
        : "https://api.themoviedb.org/3/discover/movie";

      const params = {
        api_key: apiKey,
        page: 1,
        "vote_count.gte": isTv ? tvMinVotes : movieMinVotes,
        "vote_average.gte": ratingFloor,
        sort_by: "popularity.desc",
        [isTv ? "first_air_date.lte" : "primary_release_date.lte"]: maxDateStr,
      };

      if (!isTv && intent.excludeViolence && !isRegional) {
        params.certification_country = "US";
        params["certification.lte"] = "PG-13";
      }
      if (minDateStr) {
        params[isTv ? "first_air_date.gte" : "primary_release_date.gte"] =
          minDateStr;
      }
      if (intent.detectedLanguage)
        params.with_original_language = intent.detectedLanguage;
      if (intent.detectedCountry)
        params.with_origin_country = intent.detectedCountry;

      const primary = isTv ? primaryTvG : primaryMovieG;
      if (primary) params.with_genres = primary;

      const singleKw = cuteAnimeKw || darkAnimeKw || pickWithKeyword();
      if (singleKw && !(isTv && singleKw === swordKw)) {
        params.with_keywords = singleKw;
      } else if (excludeHeroKw && !isTv) {
        params.without_keywords = excludeHeroKw;
      }

      if (withoutKwStr) params.without_keywords = withoutKwStr;

      if (!isTv) params.without_genres = movieWithoutGenres;
      if (isTv) {
        const tvExIds = [];
        if (intent.excludedGenres && intent.excludedGenres.length > 0) {
          intent.excludedGenres.forEach((exG) => {
            if (isSwordWar && exG === "war") return;
            if (TMDB_GENRE_IDS.tv[exG])
              tvExIds.push(String(TMDB_GENRE_IDS.tv[exG]));
          });
        }
        if (intent.excludeViolence) tvExIds.push("27");
        if (intent.excludedGenres.includes("comedy")) tvExIds.push("35");

        const baseTvWithout = isFamilyAnim
          ? ["27", "53", "80"]
          : isSitcomIntent
            ? [
                "18",
                "16",
                "10765",
                "10768",
                "10762",
                "10766",
                "27",
                "80",
                "9648",
                "53",
              ]
            : isComfortCom || isPureCom
              ? [
                  "18",
                  "16",
                  "10765",
                  "10768",
                  "10762",
                  "27",
                  "80",
                  "9648",
                  "53",
                ]
              : isCrimeFam || isHaunted
                ? ["10751", "10762", "16"]
                : isCuteAnime
                  ? ["10762"]
                  : ["16", "10767", "10763", "10764"];

        params.without_genres = Array.from(
          new Set([...baseTvWithout, ...tvExIds]),
        ).join(",");

        if (isCuteAnime) {
          params.with_genres = "35,10749,16";
          params.without_keywords = animeAntiEcchi;
        } else if (tvFantasyExclude) {
          params.without_keywords = tvFantasyExclude;
        }
      }

      try {
        const [p1Res, p2Res] = await Promise.all([
          tmdbGet(endpoint, { params: { ...params, page: 1 } }),
          tmdbGet(endpoint, { params: { ...params, page: 2 } }),
        ]);
        const list = [
          ...(p1Res.data.results || []),
          ...(p2Res.data.results || []),
        ];

        if (
          list.length < 4 &&
          (params.with_keywords || params.certification_country)
        ) {
          const relaxed = { ...params };
          delete relaxed.with_keywords;
          delete relaxed.certification_country;
          delete relaxed["certification.lte"];
          const suppRes = await tmdbGet(endpoint, {
            params: { ...relaxed, page: 1 },
          }).catch(() => ({ data: { results: [] } }));
          list.push(...(suppRes.data?.results || []));
        }

        candidates.push(
          ...list.map((it) => ({
            ...it,
            media_type: isTv ? "tv" : "movie",
            matched_strict_format: Boolean(formatKw),
          })),
        );
      } catch (err) {
        const resData = await tmdbGet(endpoint, { params });
        candidates.push(
          ...(resData.data.results || []).map((it) => ({
            ...it,
            media_type: isTv ? "tv" : "movie",
            matched_strict_format: Boolean(formatKw),
          })),
        );
      }
    }
  }

  // Date & vote floor filtering
  candidates = candidates.filter((item) => {
    const rel = item.release_date || item.first_air_date;
    const votes = item.vote_count || 0;

    if (!rel || rel > todayStr) return false;
    if (intent.isNowPlaying) {
      if (item.media_type && item.media_type !== "movie") return false;
      if (rel < minNowPlayingStr) return false;
    }

    const yr = parseInt(rel.split("-")[0], 10);
    if (intent.minYear && yr < intent.minYear) return false;
    if (intent.maxYear && yr > intent.maxYear) return false;

    if (
      item.isActorMatch ||
      hasExplicitActorRequest ||
      isPre1980 ||
      isArabicQuery ||
      yr < 1980 ||
      item.original_language === "ar"
    ) {
      return true;
    }

    const minVotes = intent.isNowPlaying
      ? 20
      : isRegional || hasFormats || isPre1970
        ? 15
        : tightConstraints
          ? 25
          : intent.targetType === "anime" ||
              isCuteAnime ||
              isDarkAnime ||
              isKorean ||
              isTrueCrime
            ? 40
            : 200;

    return votes >= minVotes;
  });

  const watchedIds =
    typeof getWatchedIdsFn === "function"
      ? await getWatchedIdsFn(candidates)
      : new Set();

  candidates = candidates.filter(
    (c) => !watchedIds.has(Number(c.id)) && !seenIds.has(Number(c.id)),
  );

  const uniqueMap = new Map();
  candidates.forEach((c) => {
    if (!uniqueMap.has(c.id)) {
      uniqueMap.set(c.id, c);
    } else {
      const prev = uniqueMap.get(c.id);
      if (c.isActorMatch && !prev.isActorMatch) {
        uniqueMap.set(c.id, { ...prev, ...c });
      }
    }
  });
  candidates = Array.from(uniqueMap.values()).map((c) => ({
    ...c,
    genres: (c.genre_ids || [])
      .map((id) => TMDB_ID_TO_NAME[id] || "")
      .filter(Boolean),
  }));

  // Post-fetch strict constraint filtering
  const isSciFiAnchor =
    anchors.some(
      (a) =>
        a.media?.genre_ids?.includes(878) ||
        a.media?.genre_ids?.includes(10765) ||
        a.meta?.genre === "scifi",
    ) || intent.detectedGenres.includes("scifi");

  const exGenreIds = new Set(intent.excludedGenreIds || []);
  if (intent.excludeViolence) exGenreIds.add(27);
  const exKwIds = new Set(intent.excludedKeywords || []);

  const exTerms = [...(intent.excludedTermsFromPrompt || [])];
  (intent.excludedGenres || []).forEach((g) => {
    if (isSwordWar && g === "war") return;
    if (g === "horror") {
      exTerms.push("horror", "slasher", "demonic", "exorcism", "terrifying");
      return;
    }
    if (genreMap[g]) exTerms.push(...genreMap[g]);
  });

  const heroRx =
    /\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc\s*comics|comic\s*book|avengers|batman|superman|wonder woman|justice society|justice league|flash|aquaman)\b/i;

  const noHero =
    exKwIds.has("9715") ||
    /\b(?:no|exclude|without|except|zero)\s+.*?\b(superhero|marvel|dc|superheroes)\b/i.test(
      cleanPrompt,
    );

  const strictGenreIds = new Set();
  if (
    Array.isArray(intent.detectedGenres) &&
    intent.detectedGenres.length > 0
  ) {
    intent.detectedGenres.forEach((g) => {
      if (TMDB_GENRE_IDS.movie[g])
        strictGenreIds.add(Number(TMDB_GENRE_IDS.movie[g]));
      if (TMDB_GENRE_IDS.tv[g])
        strictGenreIds.add(Number(TMDB_GENRE_IDS.tv[g]));
    });
  }

  candidates = candidates.filter((c) => {
    const gIds = c.genre_ids || [];
    const title = (c.title || c.name || "").toLowerCase();
    const blob = `${title} ${c.overview || ""}`.toLowerCase();
    const rel = c.release_date || c.first_air_date || "";
    const yr = rel ? parseInt(rel.split("-")[0], 10) : 0;

    const rawKw = Array.isArray(c.keywords)
      ? c.keywords
      : c.keywords?.keywords || c.keywords?.results || [];
    const kwIds = rawKw
      .map((k) => (typeof k === "object" ? k?.id : Number(k)))
      .filter(Boolean);

    if (isDarkCom) {
      if (
        gIds.includes(99) ||
        gIds.includes(10402) ||
        /\b(stand-up|stand up|comedy special|live at|bo burnham|bill burr|dave chappelle|ricky gervais|louis c\.k\.|kevin hart|chris rock|jim jefferies|george carlin)\b/i.test(
          blob,
        )
      ) {
        return false;
      }
    }

    if (isTrueCrime) {
      if (
        /\b(cosmos|planet earth|our planet|blue planet|astronomy|outer space|wildlife|nature|solar system|universe|dinosaurs?|national geographic)\b/i.test(
          blob,
        )
      ) {
        return false;
      }
    }

    if (intent.excludeViolence) {
      if (
        gIds.includes(27) ||
        GORE_FILTER_RX.test(title) ||
        GORE_FILTER_RX.test(blob)
      ) {
        return false;
      }
    }

    if (hasFormats) {
      if (intent.strictFormats.includes("silent")) {
        const silent =
          Boolean(c.matched_strict_format) ||
          kwIds.includes(154802) ||
          /\b(silent|silent film|silent movie|silent era|pantomime|intertitles)\b/i.test(
            blob,
          ) ||
          (yr > 0 && yr <= 1931);
        if (!silent) return false;
      }
      if (intent.strictFormats.includes("black and white")) {
        const bw =
          Boolean(c.matched_strict_format) ||
          kwIds.includes(10183) ||
          /\b(black and white|black & white|b&w|monochrome|noir)\b/i.test(
            blob,
          ) ||
          (yr > 0 && yr <= 1960);
        if (!bw) return false;
      }
    }

    if (
      strictGenreIds.size > 0 &&
      (hasExplicitActorRequest || Boolean(resolvedDirectorId) || noFallback)
    ) {
      if (!gIds.some((id) => strictGenreIds.has(Number(id)))) return false;
    }

    const isAnimeCand =
      c.media_type === "anime" ||
      (c.original_language === "ja" && gIds.includes(16));

    if (isAnime && (c.original_language !== "ja" || !gIds.includes(16))) {
      return false;
    }

    if (isAnimeCand || isAnime || isCuteAnime) {
      const hasEcchi = kwIds.some((id) => [2858, 190370, 9716].includes(id));
      if (
        hasEcchi ||
        ECCHI_FILTER_RX.test(title) ||
        ECCHI_FILTER_RX.test(blob)
      ) {
        return false;
      }
      if (isCuteAnime && (gIds.includes(10762) || KIDS_FILTER_RX.test(title))) {
        return false;
      }
    }

    if (
      isSitcomIntent &&
      (gIds.includes(27) || gIds.includes(80) || gIds.includes(53))
    ) {
      return false;
    }

    if (
      isSwordWar &&
      intent.targetType !== "anime" &&
      focus !== "anime" &&
      !intent.wantsExplicitAnime &&
      (isAnimeCand || gIds.includes(16))
    ) {
      return false;
    }

    if (intent.detectedGenres.includes("scifi")) {
      const hasSciFi =
        gIds.includes(878) ||
        gIds.includes(10765) ||
        (wantsTime &&
          /\b(time loop|time travel|groundhog day|palm springs|predestination|source code|looper|edge of tomorrow)\b/i.test(
            blob,
          ));
      if (!hasSciFi) return false;
    }

    if (isSciFiAnchor) {
      const pureHorror =
        gIds.includes(27) && !gIds.includes(878) && !gIds.includes(10765);
      const pureCrime =
        (gIds.includes(80) || gIds.includes(99)) &&
        !gIds.includes(878) &&
        !gIds.includes(10765);
      if (pureHorror || pureCrime) return false;
    }

    if (isSwordWar) {
      const modern =
        MODERN_WAR_RX.test(title) ||
        MODERN_WAR_RX.test(blob) ||
        (gIds.includes(80) && !SWORD_WAR_RX.test(blob));
      if (modern) return false;
    }

    if (
      Array.isArray(c.genre_ids) &&
      c.genre_ids.some((id) => exGenreIds.has(Number(id)))
    ) {
      return false;
    }

    if (
      intent.excludedGenres.includes("family") &&
      (gIds.includes(10751) ||
        gIds.includes(10762) ||
        KIDS_FILTER_RX.test(title))
    ) {
      return false;
    }

    if (noHero && (kwIds.includes(9715) || heroRx.test(blob))) {
      return false;
    }

    const strictTerms = exTerms.filter(
      (t) =>
        ![
          "detective",
          "modern",
          "ecchi",
          "harem",
          "violence",
          "violent",
          "gore",
          "gory",
          "slasher",
          "scary",
          "creepy",
          "spooky",
          "fear",
        ].includes(t),
    );
    if (
      strictTerms.length > 0 &&
      strictTerms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(blob))
    ) {
      return false;
    }

    if (
      intent.excludedTermsFromPrompt?.includes("detective") &&
      /\b(detective|police detective)\b/i.test(title)
    ) {
      return false;
    }

    return true;
  });

  // Fallback discover if candidates < 4
  if (
    candidates.length < 4 &&
    !resolvedDirectorId &&
    !hasExplicitActorRequest &&
    !noFallback
  ) {
    try {
      const isTv =
        !intent.isNowPlaying &&
        (intent.targetType === "tv" ||
          intent.targetType === "anime" ||
          isAnime);
      const fbUrl = isTv
        ? "https://api.themoviedb.org/3/discover/tv"
        : "https://api.themoviedb.org/3/discover/movie";

      let fbGenre = isTv ? primaryTvG : primaryMovieG;
      if (!fbGenre) {
        if (wantsSciFi) fbGenre = isTv ? "10765" : "878";
        else if (isSwordWar) {
          fbGenre = isTv
            ? "10768|36"
            : intent.excludeViolence
              ? "36|12|10751"
              : "36|10752";
        } else if (isCrimeHeist || isCrimeFam || isHeist) {
          fbGenre = isTv ? "80" : "80,18";
        } else if (
          sportsKw ||
          intent.detectedLanguage ||
          intent.detectedCountry ||
          intent.isNowPlaying
        ) {
          fbGenre = undefined;
        } else {
          fbGenre = isTv ? "18" : "28,18";
        }
      }

      const fbParams = {
        api_key: apiKey,
        page: 1,
        "vote_count.gte":
          isPre1980 || isArabicQuery
            ? 3
            : intent.isNowPlaying
              ? 20
              : sportsKw
                ? 30
                : isRegional
                  ? 15
                  : 50,
        "vote_average.gte": ratingFloor,
        sort_by: "popularity.desc",
        [isTv ? "first_air_date.gte" : "primary_release_date.gte"]:
          intent.isNowPlaying
            ? minNowPlayingStr
            : intent.minYear
              ? `${intent.minYear}-01-01`
              : isSwordWar || isRegional || isPre1980 || sportsKw
                ? "1950-01-01"
                : "2000-01-01",
        [isTv ? "first_air_date.lte" : "primary_release_date.lte"]: maxDateStr,
      };

      if (!isTv && intent.excludeViolence && !isRegional) {
        fbParams.certification_country = "US";
        fbParams["certification.lte"] = "PG-13";
      }
      if (fbGenre) fbParams.with_genres = fbGenre;
      if (sportsKw) fbParams.with_keywords = sportsKw;
      else if (trueCrimeKw) fbParams.with_keywords = trueCrimeKw;

      if (isSitcomIntent && isTv && !isAnime) {
        fbParams.without_genres = "18,16,10765,10768,10762,10766,27,80,9648,53";
      } else if (!isTv) {
        fbParams.without_genres = movieWithoutGenres;
      } else if (intent.excludeViolence || exGenreIds.has(27)) {
        fbParams.without_genres = "27";
      }

      if (isAnime && !intent.isNowPlaying) {
        fbParams.with_original_language = "ja";
        fbParams.with_genres = fbGenre
          ? Array.from(new Set([...String(fbGenre).split(/[|,]/), "16"])).join(
              ",",
            )
          : "16";
        fbParams.without_keywords = animeAntiEcchi;
        fbParams.without_genres = intent.excludeViolence ? "10762,27" : "10762";
      } else if (intent.detectedLanguage) {
        fbParams.with_original_language = intent.detectedLanguage;
      }

      if (intent.detectedCountry)
        fbParams.with_origin_country = intent.detectedCountry;
      if (excludeHero) fbParams.without_keywords = "9715";

      const fbRes = await tmdbGet(fbUrl, { params: fbParams });
      const rawFb = (fbRes.data?.results || []).map((m) => ({
        ...m,
        media_type:
          isAnime && !intent.isNowPlaying ? "anime" : isTv ? "tv" : "movie",
        genres: (m.genre_ids || [])
          .map((id) => TMDB_ID_TO_NAME[id] || "")
          .filter(Boolean),
      }));

      const freshFb = rawFb.filter((c) => {
        const rel = c.release_date || c.first_air_date;
        if (!rel || rel > todayStr) return false;
        if (intent.isNowPlaying && rel < minNowPlayingStr) return false;

        const yr = parseInt(rel.split("-")[0], 10);
        if (intent.minYear && yr < intent.minYear) return false;
        if (intent.maxYear && yr > intent.maxYear) return false;

        const gIds = c.genre_ids || [];
        const tText = (c.title || c.name || "").toLowerCase();
        const blob = `${tText} ${c.overview || ""}`.toLowerCase();

        if (gIds.some((id) => exGenreIds.has(Number(id)))) return false;

        if (
          intent.excludeViolence &&
          (gIds.includes(27) ||
            GORE_FILTER_RX.test(tText) ||
            GORE_FILTER_RX.test(blob))
        ) {
          return false;
        }

        if (isAnime && (c.original_language !== "ja" || !gIds.includes(16))) {
          return false;
        }

        if (
          isSitcomIntent &&
          (gIds.includes(27) || gIds.includes(80) || gIds.includes(53))
        ) {
          return false;
        }

        const isAnimeItem =
          c.media_type === "anime" ||
          (c.original_language === "ja" && gIds.includes(16));
        if (
          (isCuteAnime ||
            isAnime ||
            intent.targetType === "anime" ||
            isAnimeItem) &&
          ECCHI_FILTER_RX.test(tText)
        ) {
          return false;
        }
        if (
          isSwordWar &&
          (MODERN_WAR_RX.test(tText) ||
            (!intent.wantsExplicitAnime && isAnimeItem))
        ) {
          return false;
        }
        return (
          !watchedIds.has(Number(c.id)) &&
          !seenIds.has(Number(c.id)) &&
          !candidates.some((existing) => existing.id === c.id)
        );
      });

      candidates.push(...freshFb);
    } catch (err) {
      console.error("Fallback fetch failed:", err.message);
    }
  }

  return {
    candidates,
    resolvedDirectorId,
    resolvedActorIds,
    resolvedActorNames,
    requestedActorsList,
    hasExplicitActorRequest,
    isSitcomIntent,
  };
};
