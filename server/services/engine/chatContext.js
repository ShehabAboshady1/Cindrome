import { KNOWN_DIRECTORS, genreMap, TMDB_GENRE_IDS } from "./constants.js";
import { normalizePromptSpelling } from "./textHelper.js";
import { parseQuery } from "./queryParser.js";

export const getUserPreviousTexts = (history = []) => {
  return Array.isArray(history)
    ? history
        .filter((msg) => msg.role === "user" && msg.text)
        .map((msg) => msg.text.trim())
    : [];
};

export const getSessionSeenIds = (history = []) => {
  const seenIds = new Set();
  if (Array.isArray(history)) {
    history.forEach((msg) => {
      if (msg.results && Array.isArray(msg.results)) {
        msg.results.forEach((item) => {
          if (item && item.id) seenIds.add(Number(item.id));
        });
      }
    });
  }
  return seenIds;
};

export const mergeContext = (
  intent,
  prevTexts = [],
  cleanPrompt = "",
  focus = "mixed",
) => {
  if (!Array.isArray(prevTexts) || prevTexts.length === 0) {
    return intent;
  }

  const relaxed = intent.relaxedConstraints || {
    dropEra: false,
    dropFormats: false,
    dropOrigins: false,
    droppedGenres: [],
  };
  const isReplacing = Boolean(intent.replacePrevious || intent.isPivot);

  const combinedText = `${prevTexts.join(" ")} ${cleanPrompt}`.trim();
  const cumIntent = parseQuery(combinedText, focus);

  const droppedGenres = new Set(relaxed.droppedGenres || []);
  const curIncGenres = new Set(intent.detectedGenres || []);
  const curExGenres = new Set(intent.excludedGenres || []);
  const curIncKws = new Set(
    (intent.detectedKeywords || []).map((k) => k.name.toLowerCase()),
  );
  const curExTerms = new Set(intent.excludedTermsFromPrompt || []);

  const histGenres = new Set();
  let histTarget = null;
  let histLang = null;
  let histCountry = null;
  let histRegion = null;
  let histOrigins = [];
  let histFormats = [];
  let histDirector = null;
  let histActors = [];
  let histMinYear = null;
  let histMaxYear = null;
  let histMinRating = null;
  let histNowPlaying = false;
  let histWantsAnime = false;
  let histNoViolence = false;

  for (const prevText of prevTexts) {
    const prevNorm = normalizePromptSpelling(prevText);
    const prevParsed = parseQuery(prevNorm, focus);
    const prevRel = prevParsed.relaxedConstraints || {};

    if (prevRel.dropEra) {
      histMinYear = null;
      histMaxYear = null;
    }
    if (prevRel.dropFormats) {
      histFormats = [];
    }
    if (prevRel.dropOrigins) {
      histOrigins = [];
      histLang = null;
      histCountry = null;
      histRegion = null;
      histWantsAnime = false;
    }
    if (Array.isArray(prevRel.droppedGenres)) {
      prevRel.droppedGenres.forEach((dg) => histGenres.delete(dg));
    }

    if (prevParsed.replacePrevious || prevParsed.isPivot) {
      if (
        Array.isArray(prevParsed.detectedGenres) &&
        prevParsed.detectedGenres.length > 0
      ) {
        histGenres.clear();
      }
      if (Array.isArray(prevParsed.origins) && prevParsed.origins.length > 0) {
        histOrigins = [];
        histLang = null;
        histCountry = null;
        histRegion = null;
        histWantsAnime = false;
      }
    }

    (prevParsed.detectedGenres || []).forEach((g) => histGenres.add(g));

    if (prevParsed.minYear !== null && prevParsed.minYear !== undefined) {
      histMinYear = prevParsed.minYear;
    }
    if (prevParsed.maxYear !== null && prevParsed.maxYear !== undefined) {
      histMaxYear = prevParsed.maxYear;
    }
    if (prevParsed.minRating !== null && prevParsed.minRating !== undefined) {
      histMinRating = prevParsed.minRating;
    }
    if (prevParsed.extractedDirector) {
      histDirector = prevParsed.extractedDirector;
    }
    if (Array.isArray(prevParsed.actors) && prevParsed.actors.length > 0) {
      histActors = Array.from(new Set([...histActors, ...prevParsed.actors]));
    }
    if (Array.isArray(prevParsed.origins) && prevParsed.origins.length > 0) {
      histOrigins = Array.from(
        new Set([...histOrigins, ...prevParsed.origins]),
      );
    }
    if (
      Array.isArray(prevParsed.strictFormats) &&
      prevParsed.strictFormats.length > 0
    ) {
      histFormats = Array.from(
        new Set([...histFormats, ...prevParsed.strictFormats]),
      );
    }
    if (prevParsed.isNowPlaying) histNowPlaying = true;
    if (prevParsed.excludeViolence) histNoViolence = true;

    if (prevParsed.targetType && prevParsed.targetType !== "mixed") {
      histTarget = prevParsed.targetType;
    }
    if (prevParsed.wantsExplicitAnime || prevParsed.targetType === "anime") {
      histWantsAnime = true;
      histTarget = "anime";
      histLang = "ja";
      histCountry = "JP";
      histRegion = "Japanese";
      histGenres.add("animation");
    } else if (prevParsed.detectedLanguage) {
      histLang = prevParsed.detectedLanguage;
      histCountry = prevParsed.detectedCountry;
      histRegion = prevParsed.detectedRegionLabel;
    }

    if (prevParsed.hasContradiction) {
      const stripped = prevNorm
        .toLowerCase()
        .replace(
          /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi,
          " ",
        );
      for (const [gKey, kwList] of Object.entries(genreMap)) {
        if (
          kwList.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(stripped))
        ) {
          histGenres.add(gKey);
        }
      }
      if (/\b(movie|movies|film|films)\b/i.test(stripped) && !histWantsAnime) {
        histTarget = histTarget || "movie";
      } else if (
        /\b(series|show|shows|tv|sitcom|k-drama|kdrama)\b/i.test(stripped) &&
        !histWantsAnime
      ) {
        histTarget = histTarget || "tv";
      }
    }
  }

  droppedGenres.forEach((dg) => histGenres.delete(dg));

  let exGenres = Array.from(
    new Set([
      ...(isReplacing ? [] : cumIntent.excludedGenres || []),
      ...(intent.excludedGenres || []),
    ]),
  ).filter((g) => !curIncGenres.has(g));

  const exTerms = Array.from(
    new Set([
      ...(isReplacing ? [] : cumIntent.excludedTermsFromPrompt || []),
      ...(intent.excludedTermsFromPrompt || []),
    ]),
  ).filter((term) => {
    if (curIncGenres.has(term) || curIncKws.has(term)) return false;
    for (const incG of curIncGenres) {
      if (genreMap[incG] && genreMap[incG].includes(term)) return false;
    }
    return true;
  });

  const incKwIds = new Set(
    (intent.detectedKeywords || []).map((k) => String(k.id)),
  );
  const exKws = Array.from(
    new Set([
      ...(isReplacing ? [] : cumIntent.excludedKeywords || []),
      ...(intent.excludedKeywords || []),
    ]),
  ).filter((kwId) => !incKwIds.has(String(kwId)));

  if (intent.isSwordWarfare || cumIntent.isSwordWarfare) {
    exGenres = exGenres.filter((g) => g !== "war");
  }

  intent.excludedGenres = exGenres;
  intent.excludedKeywords = exKws;
  intent.excludedTermsFromPrompt = exTerms;
  intent.excludeViolence = Boolean(
    intent.excludeViolence || (!isReplacing && histNoViolence),
  );

  const exGenreIds = [];
  intent.excludedGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.movie[g]) exGenreIds.push(TMDB_GENRE_IDS.movie[g]);
    if (TMDB_GENRE_IDS.tv[g]) exGenreIds.push(TMDB_GENRE_IDS.tv[g]);
  });
  intent.excludedGenreIds = Array.from(new Set(exGenreIds));

  if (isReplacing && intent.detectedGenres.length > 0) {
    intent.detectedGenres = intent.detectedGenres.filter(
      (g) =>
        !intent.excludedGenres.includes(g) &&
        !droppedGenres.has(g) &&
        !curExGenres.has(g) &&
        !curExTerms.has(g),
    );
  } else if (intent.detectedGenres.length > 0) {
    const extraGenres = Array.from(histGenres).filter(
      (g) => !intent.detectedGenres.includes(g),
    );
    intent.detectedGenres = [...intent.detectedGenres, ...extraGenres].filter(
      (g) =>
        !intent.excludedGenres.includes(g) &&
        !droppedGenres.has(g) &&
        !curExGenres.has(g) &&
        !curExTerms.has(g),
    );
  } else {
    intent.detectedGenres = Array.from(histGenres).filter(
      (g) =>
        !intent.excludedGenres.includes(g) &&
        !droppedGenres.has(g) &&
        !curExGenres.has(g) &&
        !curExTerms.has(g),
    );
  }

  if (relaxed.dropEra) {
    intent.minYear = null;
    intent.maxYear = null;
    intent.wantsClassic = false;
  } else if (
    intent.preservesAnaphoricEra ||
    !isReplacing ||
    (intent.minYear === null && intent.maxYear === null)
  ) {
    if (intent.minYear === null && histMinYear !== null) {
      intent.minYear = histMinYear;
    }
    if (intent.maxYear === null && histMaxYear !== null) {
      intent.maxYear = histMaxYear;
    }
  }

  if (relaxed.dropFormats) {
    intent.strictFormats = [];
  } else if (
    !isReplacing &&
    (!intent.strictFormats || intent.strictFormats.length === 0) &&
    histFormats.length > 0
  ) {
    intent.strictFormats = [...histFormats];
  }

  if (relaxed.dropOrigins) {
    intent.origins = [];
    intent.detectedLanguage = null;
    intent.detectedCountry = null;
    intent.detectedRegionLabel = null;
    intent.isKorean = false;
    intent.wantsExplicitAnime = false;
    if (intent.targetType === "anime") {
      intent.targetType = focus === "anime" ? "anime" : "mixed";
    }
  } else if (isReplacing && intent.origins && intent.origins.length > 0) {
    intent.isKorean =
      intent.origins.includes("Korean") || intent.detectedLanguage === "ko";
    if (
      !intent.wantsExplicitAnime &&
      !intent.origins.includes("Japanese") &&
      intent.targetType === "anime"
    ) {
      intent.targetType = intent.hasExplicitTargetType
        ? intent.targetType
        : "movie";
    }
  } else if (
    !isReplacing &&
    (!intent.origins || intent.origins.length === 0) &&
    histOrigins.length > 0
  ) {
    intent.origins = [...histOrigins];
    if (!intent.detectedLanguage && histLang) {
      intent.detectedLanguage = histLang;
      intent.detectedCountry = histCountry;
      intent.detectedRegionLabel = histRegion;
      intent.isKorean = histLang === "ko";
    }
  }

  const switchedOrigin =
    intent.origins &&
    intent.origins.length > 0 &&
    !intent.origins.includes("Japanese");

  if (
    histWantsAnime &&
    !relaxed.dropOrigins &&
    !switchedOrigin &&
    !intent.isLiveAction &&
    !(
      isReplacing &&
      intent.hasExplicitTargetType &&
      intent.targetType !== "anime"
    )
  ) {
    intent.targetType = "anime";
    intent.hasExplicitTargetType = true;
    intent.wantsExplicitAnime = true;
    intent.detectedLanguage = "ja";
    intent.detectedCountry = "JP";
    intent.detectedRegionLabel = "Japanese";
    if (
      !intent.detectedGenres.includes("animation") &&
      !intent.excludedGenres.includes("animation") &&
      !droppedGenres.has("animation")
    ) {
      intent.detectedGenres.push("animation");
    }
    if (
      intent.detectedGenres.includes("romance") &&
      !intent.excludedGenres.includes("romance")
    ) {
      intent.isCuteAnimeRomCom = true;
    }
  } else if (
    !intent.hasExplicitTargetType &&
    !isReplacing &&
    histTarget &&
    histTarget !== "mixed"
  ) {
    intent.targetType = histTarget;
  }

  if (!isReplacing || intent.preservesAnaphoricPerson) {
    if (intent.minRating === null && histMinRating !== null) {
      intent.minRating = histMinRating;
    }

    const hasDirTrigger =
      /\b(?:directed\s+by|director|films?\s+by|movies?\s+by|series\s+by|shows?\s+by|works?\s+of|cinema\s+of|who\s+directed)\b/i.test(
        cleanPrompt,
      );
    const hasKnownDir = KNOWN_DIRECTORS.some((dir) => {
      const escaped = dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`, "i").test(cleanPrompt);
    });

    if (
      histDirector &&
      !hasDirTrigger &&
      !hasKnownDir &&
      !intent.extractedDirector
    ) {
      intent.extractedDirector = histDirector;
    }

    if (
      (!intent.actors || intent.actors.length === 0) &&
      histActors.length > 0
    ) {
      intent.actors = [...histActors];
      intent.extractedActors = [...histActors];
      intent.extractedActor = histActors[0] || null;
    }

    if (!intent.isNowPlaying && histNowPlaying) {
      intent.isNowPlaying = true;
    }
  }

  const isSitcomPivot =
    (isReplacing || intent.isLiveAction) &&
    (intent.isLiveAction ||
      intent.isSitcom ||
      intent.detectedGenres.includes("comedy")) &&
    !histWantsAnime &&
    (!intent.origins || intent.origins.length === 0) &&
    !/\b(anime|manga)\b/i.test(cleanPrompt);

  if (isSitcomPivot) {
    intent.detectedLanguage = null;
    intent.detectedCountry = null;
    intent.detectedRegionLabel = null;
    intent.origins = [];
    intent.isKorean = false;
    if (!intent.hasExplicitTargetType) {
      intent.targetType = "tv";
    }
  }

  const kwMap = new Map();
  [
    ...(isReplacing ? [] : cumIntent.detectedKeywords || []),
    ...(intent.detectedKeywords || []),
  ].forEach((k) => kwMap.set(k.name, k));

  intent.detectedKeywords = Array.from(kwMap.values()).filter(
    (k) =>
      !intent.excludedKeywords.includes(String(k.id)) &&
      !curExTerms.has(k.name.toLowerCase()),
  );

  if (isReplacing) {
    if (
      intent.detectedGenres.includes("comedy") ||
      intent.isLiveAction ||
      (intent.origins && intent.origins.length > 0)
    ) {
      intent.isMindBlowingAction = Boolean(intent.isMindBlowingAction);
      intent.isDarkAnime = Boolean(intent.isDarkAnime);
      intent.isCyberpunk = Boolean(intent.isCyberpunk);
      intent.isPhilosophicalSciFi = Boolean(intent.isPhilosophicalSciFi);
      intent.isSwordWarfare = Boolean(intent.isSwordWarfare);
      intent.isHistoricalWar = Boolean(intent.isHistoricalWar);
    }
  } else {
    intent.isKorean = intent.isKorean || cumIntent.isKorean;
    intent.isSwordWarfare = intent.isSwordWarfare || cumIntent.isSwordWarfare;
    intent.isTrueCrimeDoc = intent.isTrueCrimeDoc || cumIntent.isTrueCrimeDoc;
    intent.isCyberpunk = intent.isCyberpunk || cumIntent.isCyberpunk;
    intent.isPhilosophicalSciFi =
      intent.isPhilosophicalSciFi || cumIntent.isPhilosophicalSciFi;
    intent.isCrimeFamily = intent.isCrimeFamily || cumIntent.isCrimeFamily;
    intent.isHeistRobbery = intent.isHeistRobbery || cumIntent.isHeistRobbery;
    intent.isUnderdog = intent.isUnderdog || cumIntent.isUnderdog;
    intent.isHauntedHorror =
      intent.isHauntedHorror || cumIntent.isHauntedHorror;
    intent.isMindBlowingAction =
      intent.isMindBlowingAction || cumIntent.isMindBlowingAction;
    intent.isDarkAnime = intent.isDarkAnime || cumIntent.isDarkAnime;
    intent.isCuteAnimeRomCom =
      intent.isCuteAnimeRomCom || cumIntent.isCuteAnimeRomCom;
    intent.isSitcom = intent.isSitcom || cumIntent.isSitcom;
    intent.isPureComedy = intent.isPureComedy || cumIntent.isPureComedy;
    intent.isComfortComedy =
      intent.isComfortComedy || cumIntent.isComfortComedy;
    intent.hasQualityFloor =
      intent.hasQualityFloor || cumIntent.hasQualityFloor;
  }

  if (
    intent.extractedDirector ||
    (intent.actors && intent.actors.length > 0) ||
    intent.isNowPlaying ||
    isReplacing
  ) {
    if (
      (isReplacing && intent.extractedReferenceTitles?.length === 0) ||
      intent.extractedDirector ||
      (intent.actors && intent.actors.length > 0) ||
      intent.isNowPlaying
    ) {
      intent.extractedReferenceTitles = [];
      intent.anchorTitles = [];
      intent.extractedReferenceTitle = null;
    }
  } else if (
    (!intent.extractedReferenceTitles ||
      intent.extractedReferenceTitles.length === 0) &&
    cumIntent.extractedReferenceTitles &&
    cumIntent.extractedReferenceTitles.length > 0
  ) {
    intent.extractedReferenceTitles = cumIntent.extractedReferenceTitles;
    intent.anchorTitles = [...cumIntent.extractedReferenceTitles];
    intent.extractedReferenceTitle =
      cumIntent.extractedReferenceTitles[0] || null;
  }

  const hasPre1970 = Boolean(
    !relaxed.dropEra &&
    ((intent.minYear !== null && intent.minYear < 1970) ||
      (intent.maxYear !== null && intent.maxYear < 1970)),
  );
  const hasFormats = Boolean(
    !relaxed.dropFormats &&
    Array.isArray(intent.strictFormats) &&
    intent.strictFormats.length > 0,
  );
  const hasMultiOrigins = Boolean(
    !relaxed.dropOrigins &&
    Array.isArray(intent.origins) &&
    intent.origins.length > 1,
  );

  intent.isHyperSpecific = Boolean(
    hasFormats ||
    hasMultiOrigins ||
    (hasPre1970 &&
      (intent.detectedGenres.length > 0 ||
        (intent.origins && intent.origins.length > 0) ||
        intent.detectedKeywords.length > 0)),
  );

  if (
    intent.detectedGenres.length > 0 ||
    intent.excludedGenres.length > 0 ||
    intent.targetType === "anime" ||
    intent.extractedDirector ||
    (intent.actors && intent.actors.length > 0) ||
    (intent.origins && intent.origins.length > 0) ||
    intent.minYear !== null ||
    intent.maxYear !== null ||
    intent.isNowPlaying ||
    intent.isHyperSpecific
  ) {
    intent.isAmbiguous = false;
    intent.isValid = true;
  }

  return intent;
};

export const mergeHistoryContext = mergeContext;
