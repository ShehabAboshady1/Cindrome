import {
  NON_DIRECTOR_WORDS,
  CHAT_STOPWORDS,
  AMBIGUOUS_PERSON_MAP,
  REGION_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_TITLES,
  GENRE_MOOD_WORDS,
  GENRE_STOPWORDS,
  genreMap,
  themeKeywords,
  TMDB_GENRE_IDS,
} from "./constants.js";
import {
  getSimilarityScore,
  normalizeInput,
  isValidAmbiguousWord,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  resolveFuzzyActor,
  extractActors,
  normalizePromptSpelling,
  correctTypos,
} from "./textHelper.js";

export const detectSmallTalk = (rawText) => {
  if (!rawText || typeof rawText !== "string") return null;
  const clean = rawText
    .toLowerCase()
    .replace(/[?.,!'"():;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return null;

  if (
    /^(?:hi+|hello+|hey+|hola|yo|sup|good\s+(?:morning|afternoon|evening)|greetings)(?:\s+(?:there|drome|cindrome|bot|ai|bro|man|friend))?$/i.test(
      clean,
    )
  ) {
    return "Hey there! I'm Drome, your personal cinema & anime recommender. Tell me what mood or genre you're in (like 'dark sci-fi with a plot twist'), or name a movie, actor, or director you love!";
  }

  if (
    /^(?:how\s+(?:are\s+you|r\s+u|are\s+u|is\s+it\s+going|do\s+you\s+do)|what'?s\s+up|whats\s+up|wassup)(?:\s+(?:today|drome|bro|man))?$/i.test(
      clean,
    )
  ) {
    return "I'm doing great and ready to find your next favorite watch! What are you in the mood for today — a mind-bending thriller, a feel-good comedy, an anime, or movies by a specific actor or director?";
  }

  if (
    /^(?:thanks?(?:\s+a\s+lot|\s+so\s+much|\s+you)?|thank\s+(?:you|u)(?:\s+so\s+much|\s+very\s+much)?|thx|ty|appreciate\s+it|cool\s+thanks|awesome\s+thanks|great\s+thanks)(?:\s+(?:drome|bro|man|mate))?$/i.test(
      clean,
    )
  ) {
    return "You're very welcome! Enjoy your watch, and whenever you need another recommendation or want to switch genres, just let me know!";
  }

  if (/^(?:bye+|goodbye|see\s+ya|see\s+you|cya|good\s+night)$/i.test(clean)) {
    return "See you later! Enjoy the movies, and come back anytime you need a fresh recommendation.";
  }

  if (
    /^(?:who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do|how\s+do\s+you\s+work|help(?:\s+me)?)$/i.test(
      clean,
    )
  ) {
    return "I'm the Cindrome Personalization Engine! I can recommend movies, TV series, and anime based on your exact mood, micro-genres (like 'cyberpunk' or 'dark comedy'), favorite titles ('like Interstellar'), actors ('starring Jason Statham'), directors ('directed by Nolan'), or specific eras. What would you like to watch?";
  }

  return null;
};

export const detectSmartClarification = (rawText, reviewsCount = 0) => {
  if (!rawText || typeof rawText !== "string") return null;
  const clean = rawText
    .toLowerCase()
    .replace(/[?.,!'"():;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return null;

  const stripped = clean
    .replace(
      /\b(?:recommend|suggest|show|me|give|want|looking|for|find|movies?|films?|series|shows?|works?|by|of|with|starring|actor|director)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (AMBIGUOUS_PERSON_MAP[stripped]) {
    return AMBIGUOUS_PERSON_MAP[stripped];
  }

  if (reviewsCount >= 5) return null;

  if (
    /^(?:recommend\s+(?:me\s+)?(?:something|anything|a\s+movie|a\s+series|a\s+show|an\s+anime|some\s+(?:good\s+)?(?:movies?|films?|series|shows?|anime))|suggest\s+(?:something|a\s+movie|a\s+show|some\s+(?:good\s+)?(?:movies?|films?|series|shows?|anime))|(?:something|anything)\s+(?:good|great|nice|interesting|amazing|to\s+watch)|(?:a\s+)?(?:good|great|nice)\s+(?:movie|movies|film|films|series|show|shows|anime)|what\s+(?:should|can)\s+i\s+watch(?:\s+tonight|\s+today)?|i\s+don'?t\s+know\s+what\s+to\s+watch|idk\s+what\s+to\s+watch|surprise\s+me)$/i.test(
      clean,
    )
  ) {
    return "I'd love to help! To give you the best picks, could you tell me a bit more? For example:\n• A mood or genre (e.g., 'mind-bending sci-fi', 'dark comedy', 'cozy family movie')\n• A movie or series you loved (e.g., 'something like Shutter Island')\n• Or a favorite actor or director!";
  }

  return null;
};

export const detectContradictions = ({
  rawDetectedGenres,
  excludedGenres,
  isRomCom,
  isCuteAnimeRomCom,
  isSitcom,
  isPureComedy,
  isComfortComedy,
  isMindBlowingAction,
  isCyberpunk,
  isPhilosophicalSciFi,
  isTrueCrimeDoc,
  isFamilyAnimation,
  isHauntedHorror = false,
  wantsExplicitLiveAction,
  wantsExplicitAnime,
  isAdaptationMentioned,
  wantsClassic,
  minYear,
  maxYear,
  extractedReferenceTitles,
  extractedDirector = null,
  actors = [],
  fullContextText = "",
}) => {
  const formatGenre = (g) => (g === "scifi" ? "Sci-Fi" : g);

  const actorSet = new Set(
    (Array.isArray(actors) ? actors : [])
      .map((a) =>
        String(a || "")
          .toLowerCase()
          .trim(),
      )
      .filter(Boolean),
  );
  const dirLower = String(extractedDirector || "")
    .toLowerCase()
    .trim();

  const negStripRx =
    /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no|drop|remove|relax|ignore|forget|clear)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi;
  const posText = String(fullContextText || "")
    .replace(negStripRx, " ")
    .trim();

  const wantsHorror =
    (Array.isArray(rawDetectedGenres) &&
      rawDetectedGenres.includes("horror")) ||
    Boolean(isHauntedHorror) ||
    /\b(bloody|gore|gory|slasher|terrifying|demonic)\b/i.test(posText);

  const wantsFamily =
    (Array.isArray(rawDetectedGenres) &&
      rawDetectedGenres.includes("family")) ||
    Boolean(isFamilyAnimation) ||
    /\b(for kids|kid-friendly|kid friendly|kids|children|family-friendly|family friendly|all ages)\b/i.test(
      posText,
    );

  if (wantsHorror && wantsFamily) {
    return "It looks like there's a contradiction in your request: you asked for bloody/scary horror while also specifying family-friendly or kids content. Would you prefer a horror movie/series for adults, or a light, family-friendly watch instead?";
  }

  const wantsLight =
    /\b(light-hearted|lighthearted|cheerful|feel-good|feel good|uplifting|happy-go-lucky)\b/i.test(
      posText,
    );
  const wantsBleak =
    /\b(depressing|tragic|bleak|soul-crushing|soul crushing|devastating|heartbreaking|miserable|hopeless)\b/i.test(
      posText,
    );

  if (wantsLight && wantsBleak) {
    return "It looks like there's a tone contradiction in your request: you asked for something light-hearted/feel-good while also asking for a depressing/tragic/bleak story. Would you prefer an uplifting, feel-good watch or a heavy, emotional drama?";
  }

  for (const genre of rawDetectedGenres) {
    if (excludedGenres.includes(genre)) {
      const label = formatGenre(genre);
      return `It looks like there's a contradiction in your request: you asked for ${label} while also excluding ${label}. Could you clarify whether you'd like to include or exclude ${label}?`;
    }
  }

  if (
    (isRomCom || isCuteAnimeRomCom) &&
    (excludedGenres.includes("romance") || excludedGenres.includes("comedy"))
  ) {
    const blocked = excludedGenres.includes("romance") ? "romance" : "comedy";
    return `You requested a Romantic Comedy (Rom-Com) while also excluding ${blocked}. Would you prefer a pure ${blocked === "romance" ? "comedy" : "romance"} instead, or should I keep the Rom-Com vibe?`;
  }

  if (
    (isSitcom || isPureComedy || isComfortComedy) &&
    excludedGenres.includes("comedy")
  ) {
    return "You asked for a Sitcom / Comedy while also excluding comedy. Please let me know if you want light comedy recommendations or a different genre entirely!";
  }

  if (
    (isMindBlowingAction || isCyberpunk || isPhilosophicalSciFi) &&
    excludedGenres.includes("scifi")
  ) {
    return "You requested a Cyberpunk / Sci-Fi concept while also excluding Sci-Fi. Would you like to keep the Sci-Fi theme or switch to a grounded non-Sci-Fi thriller/action?";
  }

  if (
    isTrueCrimeDoc &&
    (excludedGenres.includes("documentary") || excludedGenres.includes("crime"))
  ) {
    const blocked = excludedGenres.includes("documentary")
      ? "documentaries"
      : "crime";
    return `You asked for a True Crime Documentary while excluding ${blocked}. Would you prefer a fictional crime thriller or a true crime docuseries?`;
  }

  if (
    isFamilyAnimation &&
    (excludedGenres.includes("animation") || excludedGenres.includes("family"))
  ) {
    const blocked = excludedGenres.includes("animation")
      ? "animation"
      : "family";
    return `You requested a Family Animation title while also excluding ${blocked}. Could you clarify which one you'd like to prioritize?`;
  }

  if (wantsExplicitLiveAction && wantsExplicitAnime && !isAdaptationMentioned) {
    return "You asked for both Live-Action and Anime at the same time. Would you prefer animated Japanese anime or live-action movies/series?";
  }

  if (wantsClassic && minYear && minYear >= 2010) {
    return `You asked for a classic/retro (80s/90s) title released after ${minYear}. Would you prefer genuine 80s/90s classics, or modern releases from ${minYear} onward?`;
  }

  if (minYear !== null && maxYear !== null && minYear > maxYear) {
    return `The timeline range in your request conflicts (after ${minYear} and before ${maxYear + 1}). Could you double-check the release years you're looking for?`;
  }

  if (
    Array.isArray(extractedReferenceTitles) &&
    extractedReferenceTitles.length > 0
  ) {
    for (const refTitle of extractedReferenceTitles) {
      const refLower = String(refTitle || "")
        .toLowerCase()
        .trim();
      if (!refLower) continue;

      if (
        actorSet.has(refLower) ||
        (dirLower && refLower === dirLower) ||
        resolveFuzzyActor(refTitle) ||
        resolveFuzzyDirector(refTitle)
      ) {
        continue;
      }

      const anchor = resolveFuzzyAnchorTitle(refTitle, fullContextText);
      if (anchor && excludedGenres.includes(anchor.genre)) {
        const label = formatGenre(anchor.genre);
        return `You asked for something like "${anchor.canonical}" (which is primarily ${label}) while excluding ${label}. Would you like ${label} recommendations similar to "${anchor.canonical}", or another genre with a similar mood?`;
      }
    }
  }

  return null;
};

export const parseQuery = (text, selectedType = "mixed", reviewsCount = 0) => {
  if (/[\u0600-\u06FF]/.test(text)) {
    return {
      isValid: false,
      message:
        "Currently, Drome AI only supports English prompts. Please describe what you'd like to watch in English (e.g., 'Mind-bending sci-fi with a plot twist').",
      actors: [],
      extractedActors: [],
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: {
        dropEra: false,
        dropFormats: false,
        dropOrigins: false,
        droppedGenres: [],
      },
      replacePrevious: false,
      excludeViolence: false,
    };
  }

  const smallTalk = detectSmallTalk(text);
  if (smallTalk) {
    return {
      isValid: true,
      isSmallTalk: true,
      smallTalkMessage: smallTalk,
      message: smallTalk,
      targetType: selectedType,
      detectedGenres: [],
      detectedKeywords: [],
      actors: [],
      extractedActors: [],
      extractedActor: null,
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: {
        dropEra: false,
        dropFormats: false,
        dropOrigins: false,
        droppedGenres: [],
      },
      replacePrevious: false,
      excludeViolence: false,
      originalText: text,
    };
  }

  const clarification = detectSmartClarification(text, reviewsCount);
  if (clarification) {
    return {
      isValid: true,
      needsClarification: true,
      clarificationMessage: clarification,
      message: clarification,
      targetType: selectedType,
      detectedGenres: [],
      detectedKeywords: [],
      actors: [],
      extractedActors: [],
      extractedActor: null,
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: {
        dropEra: false,
        dropFormats: false,
        dropOrigins: false,
        droppedGenres: [],
      },
      replacePrevious: false,
      excludeViolence: false,
      originalText: text,
    };
  }

  const spelled = normalizePromptSpelling(text);
  const normRaw = normalizeInput(spelled);
  const lower = normRaw.toLowerCase().trim();

  const relaxed = {
    dropEra: false,
    dropFormats: false,
    dropOrigins: false,
    droppedGenres: [],
  };

  const relaxRx =
    /\b(?:drop|remove|relax|ignore|forget|clear|skip|ditch|leave\s+out)\s+(?:the\s+|that\s+|those\s+|any\s+|all\s+)?([^,.;!?\n]+?)(?=\s+\b(?:and\s+(?:just|give|show|recommend|suggest|focus|find|instead)|but|instead|so|just\s+give|just\s+show)\b|[,.;!?\n]|$)/gi;

  const parseRelaxClause = (clause) => {
    if (!clause) return;
    if (
      /\b(era|year|years|decade|decades|date|dates|time\s+period|timeline|19\d{2}s?|20\d{2}s?|[0-9]{2}s|old|classic|pre-1970|ancient)\b/i.test(
        clause,
      )
    ) {
      relaxed.dropEra = true;
    }
    if (
      /\b(silent|black\s+and\s+white|black\s*&\s*white|b&w|monochrome|format|formats|style)\b/i.test(
        clause,
      )
    ) {
      relaxed.dropFormats = true;
    }
    if (
      /\b(origin|origins|country|countries|nationality|language|regional|region)\b/i.test(
        clause,
      )
    ) {
      relaxed.dropOrigins = true;
    }
    for (const rule of REGION_MAP) {
      if (rule.pattern.test(clause)) relaxed.dropOrigins = true;
    }
    for (const [gName, kwList] of Object.entries(genreMap)) {
      if (
        new RegExp(`\\b${gName}\\b`, "i").test(clause) ||
        kwList.some((kw) => new RegExp(`\\b${kw}\\b`, "i").test(clause))
      ) {
        if (!relaxed.droppedGenres.includes(gName)) {
          relaxed.droppedGenres.push(gName);
        }
      }
    }
    if (
      /\b(all|everything|previous)\s+(?:constraints?|filters?|ones?|rules?|limits?)\b/i.test(
        clause,
      )
    ) {
      relaxed.dropEra = true;
      relaxed.dropFormats = true;
      relaxed.dropOrigins = true;
    }
  };

  let relaxMatch;
  while ((relaxMatch = relaxRx.exec(lower)) !== null) {
    parseRelaxClause(relaxMatch[1].toLowerCase().trim());
  }

  const withoutConstraintRx =
    /\bwithout\s+(?:the\s+|that\s+|those\s+)?([^,.;!?\n]+?)\s+(?:constraints?|filters?|limits?|restrictions?|ones?|part)\b/gi;
  let wcMatch;
  while ((wcMatch = withoutConstraintRx.exec(lower)) !== null) {
    parseRelaxClause(wcMatch[1].toLowerCase().trim());
  }

  const cleanLower = lower
    .replace(relaxRx, " ")
    .replace(withoutConstraintRx, " ")
    .replace(/\s+/g, " ")
    .trim();

  const cleanRaw = normRaw
    .replace(relaxRx, " ")
    .replace(withoutConstraintRx, " ")
    .replace(/\s+/g, " ")
    .trim();

  const negStripRx =
    /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi;
  const posText = cleanLower.replace(negStripRx, " ").trim();

  const noViolence =
    /\b(without\s+(?:any\s+|heavy\s+|extreme\s+)?violence|no\s+(?:heavy\s+|extreme\s+)?violence|no\s+gore|without\s+(?:any\s+)?gore|non[- ]violent|blood[- ]free|gore[- ]free|family[- ]friendly|kid[- ]friendly|for\s+kids|safe\s+for\s+kids|suitable\s+for\s+kids)\b/i.test(
      lower,
    );

  const exGenres = [];
  const exTerms = [];
  const exKeywords = [];

  if (noViolence) {
    exGenres.push("horror");
    exTerms.push("gore", "slasher", "violence");
  }

  const nonExcludableWords = new Set([
    "show",
    "me",
    "want",
    "i",
    "a",
    "an",
    "the",
    "movies",
    "movie",
    "films",
    "film",
    "series",
    "shows",
    "tv",
    "instead",
    "actually",
    "rather",
    "light",
    "pure",
    "give",
    "looking",
    "find",
    "some",
    "any",
    "please",
    "like",
    "with",
    "only",
    "constraint",
    "constraints",
    "filter",
    "filters",
    "limit",
    "limits",
    "restriction",
    "restrictions",
    "one",
    "ones",
    "part",
    "stuff",
    "things",
  ]);

  const negRx =
    /\b(?:exclude|without|except|zero|free\s+of|dont\s+want|don't\s+want|no)\s+([^,.;!?\n]+?)(?=\s+\b(?:instead|actually|but|however|with|and\s+also)\b|[,.;!?\n]|$)/gi;

  let match;
  while ((match = negRx.exec(cleanLower)) !== null) {
    const clause = match[1].toLowerCase().trim();

    if (/\b(silent|black\s+and\s+white|b&w|monochrome)\b/i.test(clause)) {
      relaxed.dropFormats = true;
    }
    if (/\b(19\d{2}s?|20\d{2}s?|[0-9]{2}s|decade|era)\b/i.test(clause)) {
      relaxed.dropEra = true;
    }
    for (const rule of REGION_MAP) {
      if (rule.pattern.test(clause)) relaxed.dropOrigins = true;
    }

    const tokens = clause.split(/\s+(?:or|and|nor)\s+|\s*,\s*|\s+/);

    tokens.forEach((rawToken) => {
      let token = rawToken.trim();
      if (!token || token.length <= 1 || nonExcludableWords.has(token)) return;

      if (
        [
          "violence",
          "violent",
          "gore",
          "gory",
          "blood",
          "bloody",
          "slasher",
          "scary",
          "creepy",
          "spooky",
          "terrifying",
        ].includes(token)
      ) {
        if (!exGenres.includes("horror")) exGenres.push("horror");
        if (!exTerms.includes(token)) exTerms.push(token);
        return;
      }

      if (
        [
          "ecchi",
          "exhi",
          "exchi",
          "echi",
          "etchi",
          "ecchii",
          "fanservice",
        ].includes(token) ||
        getSimilarityScore(token, "ecchi") >= 0.65
      ) {
        if (!exTerms.includes("ecchi")) exTerms.push("ecchi");
        ["2858", "190370", "9716"].forEach((id) => {
          if (!exKeywords.includes(id)) exKeywords.push(id);
        });
        return;
      }

      if (
        ["harem", "harim", "hareem"].includes(token) ||
        (token !== "haram" && getSimilarityScore(token, "harem") >= 0.72)
      ) {
        if (!exTerms.includes("harem")) exTerms.push("harem");
        ["2858", "190370", "9716"].forEach((id) => {
          if (!exKeywords.includes(id)) exKeywords.push(id);
        });
        return;
      }

      if (
        [
          "mecha",
          "robot",
          "robots",
          "mech",
          "mechs",
          "cyborg",
          "cyborgs",
        ].includes(token)
      ) {
        if (!exTerms.includes(token)) exTerms.push(token);
        if (!exKeywords.includes("209355")) exKeywords.push("209355");
        if (!exKeywords.includes("163077")) exKeywords.push("163077");
        return;
      }

      if (["superhero", "superheroes", "super"].includes(token)) {
        if (!exTerms.includes("superhero")) exTerms.push("superhero");
        if (!exKeywords.includes("9715")) exKeywords.push("9715");
        return;
      }

      if (token === "detective") {
        if (!exTerms.includes("detective")) exTerms.push("detective");
        return;
      }

      if (["modern", "guns", "gun", "firearms"].includes(token)) {
        if (!exTerms.includes(token)) exTerms.push(token);
        return;
      }

      let isGenre = false;
      for (const [gName, kwList] of Object.entries(genreMap)) {
        if (gName === token || kwList.includes(token)) {
          if (!exGenres.includes(gName)) exGenres.push(gName);
          if (!relaxed.droppedGenres.includes(gName)) {
            relaxed.droppedGenres.push(gName);
          }
          isGenre = true;
        }
      }

      if (!isGenre && !exTerms.includes(token)) exTerms.push(token);
    });
  }

  if (
    /\b(?:exclude|no|without|except|zero)\s+.*?\b(superhero|superheroes|super\s*hero|super\s*heroes|marvel|dc|comic\s*book|mcu|dceu)\b/i.test(
      lower,
    )
  ) {
    if (!exKeywords.includes("9715")) exKeywords.push("9715");
  }

  let minYear = null;
  let maxYear = null;

  if (!relaxed.dropEra) {
    const betweenMatch = posText.match(
      /\bbetween\s+(19\d{2}|20\d{2})\s+(?:and|-|to)\s+(19\d{2}|20\d{2})\b/i,
    );
    if (betweenMatch) {
      const y1 = parseInt(betweenMatch[1], 10);
      const y2 = parseInt(betweenMatch[2], 10);
      minYear = Math.min(y1, y2);
      maxYear = Math.max(y1, y2);
    } else {
      const afterMatch = posText.match(
        /\b(?:after|newer than|from|post|since)\s+(19\d{2}|20\d{2})\b/i,
      );
      if (afterMatch) minYear = parseInt(afterMatch[1], 10);

      const beforeMatch = posText.match(
        /\b(?:before|older than|prior to|pre|earlier than)\s+(19\d{2}|20\d{2})\b/i,
      );
      const upToMatch = posText.match(
        /\b(?:up to|until|through)\s+(19\d{2}|20\d{2})\b/i,
      );
      if (beforeMatch) maxYear = parseInt(beforeMatch[1], 10) - 1;
      else if (upToMatch) maxYear = parseInt(upToMatch[1], 10);

      const decMatch = posText.match(
        /\b(1900s|1910s|10s|1920s|20s|1930s|30s|1940s|40s|1950s|50s|1960s|60s|1970s|70s|1980s|80s|1990s|90s|2000s|00s|2010s|2020s)\b/i,
      );
      if (decMatch) {
        const dec = decMatch[1].toLowerCase();
        const decMap = {
          "1900s": [1900, 1909],
          "00s": [1900, 2009],
          "10s": [1910, 1919],
          "1910s": [1910, 1919],
          "20s": [1920, 1929],
          "1920s": [1920, 1929],
          "30s": [1930, 1939],
          "1930s": [1930, 1939],
          "40s": [1940, 1949],
          "1940s": [1940, 1949],
          "50s": [1950, 1959],
          "1950s": [1950, 1959],
          "60s": [1960, 1969],
          "1960s": [1960, 1969],
          "70s": [1970, 1979],
          "1970s": [1970, 1979],
          "80s": [1980, 1989],
          "1980s": [1980, 1989],
          "90s": [1990, 1999],
          "1990s": [1990, 1999],
          "2000s": [2000, 2009],
          "2010s": [2010, 2019],
          "2020s": [2020, 2029],
        };
        if (decMap[dec]) {
          if (dec === "00s") {
            const early1900s =
              /\b(1900s|early\s+00s\s+silent|silent|monochrome|black\s+and\s+white|b&w|vintage|old\s+classic)\b/i.test(
                posText,
              );
            if (minYear === null) minYear = early1900s ? 1900 : 2000;
            if (maxYear === null) maxYear = early1900s ? 1909 : 2009;
          } else {
            if (minYear === null) minYear = decMap[dec][0];
            if (maxYear === null) maxYear = decMap[dec][1];
          }
        }
      }

      if (minYear === null && maxYear === null) {
        const yearMatch = posText.match(
          /\b(?:in|from|year|released in|of)?\s*\b(19[0-9]\d|20[0-2]\d)\b/i,
        );
        if (
          yearMatch &&
          !posText.includes("blade runner 2049") &&
          !posText.includes("2001: a space odyssey") &&
          !posText.includes("2001 a space odyssey") &&
          !posText.includes("1917") &&
          !posText.includes("1922") &&
          !posText.includes("1984")
        ) {
          const yr = parseInt(yearMatch[1], 10);
          minYear = yr;
          maxYear = yr;
        }
      }
    }
  }

  let minRating = null;
  const ratingRxs = [
    /\b(?:rating|rated|score|imdb|tmdb)\s*(?:above|over|more\s+than|greater\s+than|better\s+than|exceeding|at\s+least|minimum|min|higher\s+than|>=|>|around|like|of)?\s*(\d(?:\.\d)?)\b/i,
    /\b(\d(?:\.\d)?)\s*\+\s*(?:rating|rated|stars?|imdb|tmdb|score)?\b/i,
    /\b(?:above|over|more\s+than|greater\s+than|higher\s+than|at\s+least|minimum)\s+(\d(?:\.\d)?)\s*(?:rating|rated|stars?|imdb|tmdb|score|out of 10|\/10)?\b/i,
  ];
  for (const rx of ratingRxs) {
    const rMatch = posText.match(rx);
    if (rMatch) {
      const val = parseFloat(rMatch[1]);
      if (!isNaN(val) && val >= 1.0 && val <= 9.5) {
        minRating = val;
        break;
      }
    }
  }

  const isNowPlaying =
    /\b(in\s+theat(?:er|re)s?|in\s+(?:the\s+)?cinemas?|now\s+playing|currently\s+(?:playing|showing)|playing\s+right\s+now|out\s+in\s+theat(?:er|re)s?|showing\s+in\s+theat(?:er|re)s?)\b/i.test(
      posText,
    );

  let director = null;
  const dirRxs = [
    /\b(?:directed\s+by|director|films?\s+by|movies?\s+by|series\s+by|shows?\s+by|works?\s+of|cinema\s+of)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)(?=[,.;!?]|\s+(?:after|before|without|with|from|in|above|over|rated|rating|and|or)\b|$)/i,
    /\b([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,2}?)\s+(?:movies?|films?|cinema|filmography|directorial)\b/i,
    /\b(?:best|top|greatest|favorite|favourite)\s+([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,3}?)\s+(?:movies?|films?|series|shows?|cinema|works?)\b/i,
    /\b([a-zA-Z.\-']+(?:\s+[a-zA-Z.\-']+){0,2}?)\s+(?:sci-fi|scifi|action|horror|thriller|drama|crime|mystery|comedy|war|historical|history|fantasy|animation|animated|romance|musical|western)\s+(?:movies?|films?|series|shows?|cinema|works?)\b/i,
    /\bwho\s+directed\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,5}?)(?=[,.;!?]|$)/i,
  ];

  for (const rx of dirRxs) {
    const dMatch = cleanRaw.match(rx);
    if (dMatch) {
      const cand = dMatch[1].trim();
      const fuzzy = resolveFuzzyDirector(cand);
      if (fuzzy) {
        director = fuzzy;
        break;
      } else if (
        rx === dirRxs[0] &&
        cand.split(/\s+/).length >= 2 &&
        !GENRE_STOPWORDS.has(cand.toLowerCase()) &&
        !NON_DIRECTOR_WORDS.has(cand.toLowerCase()) &&
        !resolveFuzzyActor(cand)
      ) {
        director = cand;
        break;
      }
    }
  }

  if (!director) {
    const standaloneDir = resolveFuzzyDirector(cleanRaw);
    if (standaloneDir) {
      director = standaloneDir;
    } else {
      const tokens = cleanRaw
        .replace(/[^\w\s.\-']/g, " ")
        .split(/\s+/)
        .filter(
          (t) =>
            Boolean(t) &&
            !NON_DIRECTOR_WORDS.has(t.toLowerCase()) &&
            !/^\d+$/.test(t),
        );
      for (let i = 0; i < tokens.length; i += 1) {
        const single = resolveFuzzyDirector(tokens[i]);
        if (single) {
          director = single;
          break;
        }
        if (i < tokens.length - 1) {
          const pair = resolveFuzzyDirector(`${tokens[i]} ${tokens[i + 1]}`);
          if (pair) {
            director = pair;
            break;
          }
        }
      }
    }
  }

  const actors = extractActors(cleanRaw, director);
  const firstActor = actors[0] || null;

  let genreText = posText;
  for (const act of actors) {
    const escaped = act.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    genreText = genreText.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  const isPivot =
    /\b(instead|actually|rather|change of mind|on second thought|how about|what about|switch to|focus only on|only focus on)\b/i.test(
      lower,
    );
  const replacePrevious = Boolean(
    isPivot ||
    relaxed.dropEra ||
    relaxed.dropFormats ||
    relaxed.dropOrigins ||
    relaxed.droppedGenres.length > 0,
  );
  const keepEra =
    /\b(that\s+same\s+(?:decade|era|year|period)|the\s+same\s+(?:decade|era|year|period)|same\s+(?:decade|era|year)|from\s+that\s+(?:decade|era|year))\b/i.test(
      lower,
    );
  const keepPerson =
    /\b(his|her|their|that\s+(?:actor|actress|director)|same\s+(?:actor|actress|director))\b/i.test(
      lower,
    );

  const wantsLiveAction = /\b(live action|live-action)\b/i.test(posText);
  const isAdaptation = /\b(adaptation|based on|live-action adaptation)\b/i.test(
    posText,
  );
  const wantsAnime =
    /\b(anime|manga)\b/i.test(posText) && (!wantsLiveAction || isAdaptation);

  const origins = [];
  const originObjs = [];

  if (!relaxed.dropOrigins) {
    for (const rule of REGION_MAP) {
      if (rule.pattern.test(posText) && !origins.includes(rule.label)) {
        origins.push(rule.label);
        originObjs.push({
          lang: rule.lang,
          country: rule.country,
          label: rule.label,
        });
      }
    }

    if (wantsAnime && !wantsLiveAction && !origins.includes("Japanese")) {
      origins.push("Japanese");
      originObjs.push({ lang: "ja", country: "JP", label: "Japanese" });
    }
  }

  let lang = null;
  let country = null;
  let regionLabel = null;

  if (originObjs.length > 0) {
    lang = originObjs[0].lang;
    country = originObjs[0].country;
    regionLabel =
      origins.length > 1 ? origins.join(" / ") : originObjs[0].label;
  }

  const isKorean = origins.includes("Korean") || lang === "ko";

  const strictFormats = [];
  if (!relaxed.dropFormats) {
    if (
      /\b(silent|silent\s+films?|silent\s+movies?|silent\s+era|silent\s+horror|silent\s+comedy|silent\s+cinema)\b/i.test(
        posText,
      )
    ) {
      strictFormats.push("silent");
    }
    if (
      /\b(black\s+and\s+white|black\s*&\s*white|b&w|b\s*\/\s*w|monochrome)\b/i.test(
        posText,
      )
    ) {
      strictFormats.push("black and white");
    }
  }

  const isDarkComedy =
    !exGenres.includes("comedy") &&
    /\b(dark\s+comed(?:y|ies)|black\s+comed(?:y|ies)|morbid\s+humor|dark\s+humor|darkly\s+comedic|satirical\s+dark\s+comedy)\b/i.test(
      genreText,
    );

  const isPureComedy =
    !isDarkComedy &&
    /\b(pure comedy|only comedy|strictly comedy|purely comedy|hard comedy|just comedy|pure funny|hilarious|comedy movies?|funny movies?)\b/i.test(
      genreText,
    );

  const isSitcom =
    !isDarkComedy &&
    (/\b(sitcoms?|sit-coms?|situational comed(?:y|ies))\b/i.test(genreText) ||
      (/\b(comfort|chill|relaxing|easy watch)\b/i.test(genreText) &&
        /\b(series|show|shows|tv)\b/i.test(genreText) &&
        /\b(comedy|laugh|funny)\b/i.test(genreText)));

  const hasQualityFloor =
    isPureComedy ||
    isDarkComedy ||
    /\b(mind[- ]blowing|mind blowing|masterpiece|masterpieces|epic|best|top[- ]tier|greatest|unbelievable|flawless)\b/i.test(
      genreText,
    );

  const isHaunted =
    !noViolence &&
    !exGenres.includes("horror") &&
    (/\b(cursed house|haunted house|haunted family|cursed family|scary house)\b/i.test(
      genreText,
    ) ||
      (/\b(scary|horror|haunted|cursed|creepy|demonic|evil|spooky)\b/i.test(
        genreText,
      ) &&
        /\b(house|family|home|manor|mansion|cabin)\b/i.test(genreText)));

  const isCrimeFam =
    /\b(crime family|mob family|mafia family|mafia empire|crime empire|gangster empire|building an empire|organized crime|gangster syndicate|drug empire|criminal empire)\b/i.test(
      genreText,
    );

  const isTired =
    /\b(tired|im tired|i'm tired|exhausted|long day|after a long day|stress|stressed|rough day|bad day|hard day|unwind|burnout|need a laugh|heavy day)\b/i.test(
      lower,
    );

  const withoutDrama =
    exGenres.includes("drama") ||
    /\b(without\s+(?:any\s+)?drama|no\s+drama)\b/i.test(lower) ||
    isTired ||
    isPureComedy ||
    isSitcom;

  const isPure =
    /\b(pure|strictly|only|just|100%|nothing but)\b/i.test(lower) ||
    withoutDrama;

  const strippedLower = lower
    .replace(/[?.,!]/g, "")
    .replace(/^(a|an|the)\s+/, "")
    .trim();

  const isSingleWordTitle =
    AMBIGUOUS_TITLES.has(strippedLower) &&
    isValidAmbiguousWord(strippedLower, normRaw);

  const wantsDark =
    !isSingleWordTitle &&
    !noViolence &&
    !isDarkComedy &&
    /\b(dark|grim|bleak|depressing|devastating|miserable|hopeless|mature|disturbing|gothic|brutal|suffering)\b/i.test(
      genreText,
    );

  const rawGenres = [];
  for (const [genre, keywords] of Object.entries(genreMap)) {
    if (relaxed.droppedGenres.includes(genre)) continue;
    if (
      keywords.some((kw) => {
        if (isSingleWordTitle && AMBIGUOUS_TITLES.has(kw.toLowerCase())) {
          return false;
        }
        if (
          genre === "family" &&
          kw === "family" &&
          (isHaunted || isCrimeFam) &&
          !/\b(for kids|kid-friendly|kid friendly|kids|children|family-friendly|family friendly|all ages|family movie|cozy family|wholesome)\b/i.test(
            genreText,
          )
        ) {
          return false;
        }
        return new RegExp(`\\b${kw}\\b`, "i").test(genreText);
      })
    ) {
      if (!rawGenres.includes(genre)) rawGenres.push(genre);
    }
  }

  const hasSciFi =
    !relaxed.droppedGenres.includes("scifi") &&
    /\b(sci[- ]?fi|scifi|science\s+fiction)\b/i.test(genreText);

  if (hasSciFi && !rawGenres.includes("scifi")) rawGenres.push("scifi");

  let keywords = [];
  const seenKwIds = new Set();
  for (const [theme, data] of Object.entries(themeKeywords)) {
    if (theme === "haunted house" && exGenres.includes("horror")) continue;
    if (data.terms.some((t) => new RegExp(`\\b${t}\\b`, "i").test(genreText))) {
      if (!seenKwIds.has(data.id)) {
        seenKwIds.add(data.id);
        keywords.push({ name: theme, id: data.id });
      }
    }
  }

  if (exKeywords.includes("9715")) {
    keywords = keywords.filter((k) => k.name !== "superhero");
  }

  const isSwordWar =
    keywords.some((k) => k.name === "sword warfare") ||
    /\b(swords?|sword fight|sword battles?|ancient sword battles?|swords and armies|ancient warfare|medieval warfare|old historical battles?|medieval armies|ancient battles?|gladiators?|samurai|shields and swords|ancient armies|braveheart)\b/i.test(
      genreText,
    ) ||
    (/\b(battle|battles|war|armies|army)\b/i.test(genreText) &&
      /\b(sword|swords|ancient|medieval|gladiator|samurai|shields?|old historical)\b/i.test(
        genreText,
      ));

  if (isSwordWar) {
    const warIdx = exGenres.indexOf("war");
    if (warIdx > -1) exGenres.splice(warIdx, 1);
    if (!exTerms.includes("modern")) exTerms.push("modern");
  }

  const wantsClassic =
    !relaxed.dropEra &&
    /\b(classic|retro|old|1900s|1910s|10s|1920s|20s|1930s|30s|1940s|40s|1950s|50s|1960s|60s|70s|80s|90s|1970s|1980s|1990s|vintage|nostalgic)\b/i.test(
      posText,
    );

  const isMba =
    keywords.some((k) => k.name === "mind blowing action") ||
    (/\b(mind[- ]blowing|mind blowing)\b/i.test(genreText) &&
      (rawGenres.includes("action") || /\baction\b/i.test(genreText))) ||
    (hasQualityFloor &&
      /\baction\b/i.test(genreText) &&
      /\b(mind|reality|concept|twist|sci-fi)\b/i.test(genreText));

  const isHorrorNight =
    !noViolence &&
    !exGenres.includes("horror") &&
    /\b(movie night|with friends|party|friends|sleepover|crowd|popcorn)\b/i.test(
      genreText,
    ) &&
    (rawGenres.includes("horror") ||
      /\b(horror|scary|spooky)\b/i.test(genreText));

  const isPsych =
    keywords.some((k) => k.name === "psychological thriller") ||
    /\b(psychological thriller|mess with my head|mindfuck|mind game|mind games|sanity|paranoia|unreliable narrator)\b/i.test(
      genreText,
    );

  const isRomCom =
    !isPureComedy &&
    !isDarkComedy &&
    !isSitcom &&
    (keywords.some((k) => k.name === "rom-com") ||
      /\b(rom-com|romcom|romantic comedy|sweet.*romance|light.*romance|lift my mood|feel[- ]good)\b/i.test(
        genreText,
      ) ||
      (/\b(sweet|light|chill|comfort|wholesome|cute)\b/i.test(genreText) &&
        (rawGenres.includes("romance") ||
          /\b(romance|romantic)\b/i.test(genreText))));

  const isSitcomPivot =
    (isPivot || wantsLiveAction) &&
    (isSitcom || rawGenres.includes("comedy")) &&
    !wantsAnime;

  const isCuteAnime =
    !isSitcomPivot &&
    (selectedType === "anime" || wantsAnime) &&
    (isRomCom ||
      keywords.some((k) => k.name === "cute romcom anime") ||
      (/\b(cute|wholesome|sweet|adorable|fluffy|chill|rom-com|romcom|romantic comedy)\b/i.test(
        genreText,
      ) &&
        (/\b(romance|romantic|love|rom-com|romcom)\b/i.test(genreText) ||
          /\b(funny|comedy|humor)\b/i.test(genreText))));

  const isDarkAnime =
    !isSitcomPivot &&
    !isSingleWordTitle &&
    !noViolence &&
    (selectedType === "anime" || wantsAnime) &&
    /\b(dark|bleak|grim|disturbing|psychological|gore|brutal|dark fantasy|tragedy)\b/i.test(
      genreText,
    );

  const isHistWar =
    !isSwordWar &&
    (keywords.some((k) => k.name === "historical war") ||
      /\b(historical war|war movie|war movies|huge battles|epic battles|historical epic|epic war|ancient war|medieval war|world war|ancient warfare|medieval battle)\b/i.test(
        genreText,
      ) ||
      (/\b(battle|battles|war|military|army|soldiers?)\b/i.test(genreText) &&
        /\b(historical|epic|history|ancient|medieval|period)\b/i.test(
          genreText,
        )));

  const isTrueCrime =
    keywords.some((k) => k.name === "true crime") ||
    /\b(true crime|docuseries|docu-series|real mysteries|real mystery|crime doc|crime documentary|unsolved mysteries|real crime|real crime cases|crime cases)\b/i.test(
      genreText,
    ) ||
    (/\b(documentary|docuseries|docu-series)\b/i.test(genreText) &&
      /\b(crime|murder|killer|mystery|mysteries|real crime|cases?|investigation)\b/i.test(
        genreText,
      ));

  const hasTwist =
    !isTrueCrime &&
    (keywords.some((k) => k.name === "plot twist") ||
      /\b(plot twists?|twists?|can'?t predict|unpredictable|mind[- ]blowing|mind[- ]bending|twist ending)\b/i.test(
        genreText,
      ));

  const isUnderdog =
    keywords.some((k) => k.name === "underdog") ||
    /\b(starting from zero|start from zero|starting from nothing|from zero|rags to riches|underdog(?: story)?|success story|winning against all odds|against all odds|zero to hero|rise to the top|overcoming odds)\b/i.test(
      genreText,
    );

  const isFamilyAnim =
    !isCrimeFam &&
    !isCuteAnime &&
    !isHaunted &&
    !isPureComedy &&
    !isDarkComedy &&
    !isSitcom &&
    (keywords.some((k) => k.name === "family animation") ||
      (rawGenres.includes("animation") && rawGenres.includes("family")) ||
      (/\b(animated|animation|cartoon)\b/i.test(genreText) &&
        /\b(family|kids|children|wholesome|cozy|for the whole family|family-friendly|family friendly|kid-friendly|kid friendly)\b/i.test(
          genreText,
        )));

  const isCyberpunk =
    keywords.some((k) => k.name === "cyberpunk" || k.name === "dystopia") ||
    /\b(cyberpunk|cyber-punk|dystopian?|dystopia|dark futuristic|futuristic city|androids?|cyborgs?|robots?|neon lights?|ruined future|dystopian world|cyberpunk city)\b/i.test(
      genreText,
    );

  const isPhiloSciFi =
    !isCyberpunk &&
    (keywords.some((k) => k.name === "philosophical sci-fi") ||
      (/\b(think about life|philosophical|existential|meaning of life|human condition|human existence|ponder|deep sci-fi|cosmic perspective)\b/i.test(
        genreText,
      ) &&
        (rawGenres.includes("scifi") ||
          /\b(space|universe|cosmos|sci-fi|stars|astronaut)\b/i.test(
            genreText,
          ))));

  const wantsComedy =
    rawGenres.includes("comedy") ||
    isPureComedy ||
    isDarkComedy ||
    isSitcom ||
    /\b(funny|laugh|comedy|hilarious|humor|chuckle)\b/i.test(genreText);

  const isComfortCom =
    !isDarkComedy &&
    ((isTired && wantsComedy) ||
      isPureComedy ||
      isSitcom ||
      /\b(something funny|just.*funny|comfort comedy|chill comedy|pure comedy)\b/i.test(
        genreText,
      ));

  const isHeist =
    keywords.some((k) => k.name === "heist") ||
    /\b(plan (?:a )?robbery|big robbery|bank robbery|robbery|heist|bank heist|big heist|steal money|caper|vault|safecracker|steal a fortune|heist movie)\b/i.test(
      genreText,
    );

  const isCrimeHeist =
    !isTrueCrime &&
    (isCrimeFam ||
      isHeist ||
      rawGenres.includes("crime") ||
      keywords.some(
        (k) => k.name === "organized crime" || k.name === "crime family",
      ) ||
      /\b(organized crime|mafia|gangster|mobster|mobsters|crime syndicate|underworld|cartel)\b/i.test(
        genreText,
      ));

  const refRxs = [
    /\b(?:after|watch after|watched|finished|liked|loved|enjoyed|similar to|in the style of|vibes? of|such as|something like|anything like)\s+(?!\d{4}\b)([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead|and\s+(?:want|without|no|exclude|i\s+want))\b|$)/i,
    /\b(?:based on|inspired by)\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead)\b|$)/i,
    /(?<!feel\s|feels\s|look\s|looks\s|sound\s|sounds\s)\blike\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead|to\s+watch|for\s+a)\b|$)/i,
    /\b(?:shows?|series|movies?|films?|anime)\s+(?:like|similar\s+to|such\s+as)\s+([a-zA-Z0-9':.&!\-,]+(?:\s+[a-zA-Z0-9':.&!\-,]+){0,8}?)(?=[.;!?]|\s+(?:without|except|exclude|excluding|no|but|because|so|while|instead)\b|$)/i,
  ];

  let refTitles = [];

  const addAnchor = (rawCand) => {
    if (!rawCand || refTitles.length >= 3) return;
    const cleaned = rawCand.trim().replace(/^[,.\s?]+|[,.\s?]+$/g, "");
    if (!cleaned || cleaned.length < 2) return;

    const lowerClean = cleaned.toLowerCase().replace(/^(a|an|the)\s+/, "");
    if (/^\d{2,4}s?$/.test(lowerClean)) return;
    if (
      GENRE_STOPWORDS.has(lowerClean) ||
      GENRE_STOPWORDS.has(cleaned.toLowerCase()) ||
      CHAT_STOPWORDS.has(lowerClean) ||
      CHAT_STOPWORDS.has(cleaned.toLowerCase()) ||
      AMBIGUOUS_PERSON_MAP[lowerClean]
    ) {
      return;
    }

    const words = lowerClean.split(/\s+/).filter(Boolean);
    if (
      words.length === 1 &&
      AMBIGUOUS_TITLES.has(words[0]) &&
      !isValidAmbiguousWord(words[0], normRaw)
    ) {
      return;
    }
    if (
      words.length >= 2 &&
      AMBIGUOUS_TITLES.has(words[0]) &&
      words.slice(1).every((w) => GENRE_MOOD_WORDS.has(w))
    ) {
      return;
    }

    if (
      /\b(comedy movies?|funny movies?|pure comedy|dark comedy|black comedy|sitcoms?|sitcom series|sci-fi series|dark sci-fi|dark psychological|psychological anime|dark anime|silent movies?|silent films?|black and white|western movies?|family house)\b/i.test(
        cleaned,
      )
    ) {
      return;
    }
    if (
      director &&
      (getSimilarityScore(cleaned, director) >= 0.72 ||
        resolveFuzzyDirector(cleaned) === director)
    ) {
      return;
    }
    if (
      actors.some(
        (act) =>
          getSimilarityScore(cleaned, act) >= 0.72 ||
          resolveFuzzyActor(cleaned) === act,
      )
    ) {
      return;
    }

    const fuzzy = resolveFuzzyAnchorTitle(cleaned, normRaw);
    const title = fuzzy ? fuzzy.canonical : cleaned;
    const titleLower = title.toLowerCase().replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_TITLES.has(titleLower) &&
      !isValidAmbiguousWord(titleLower, normRaw)
    ) {
      return;
    }

    if (!refTitles.some((t) => t.toLowerCase() === title.toLowerCase())) {
      refTitles.push(title);
    }
  };

  for (const rx of refRxs) {
    const pMatch = cleanRaw.match(rx);
    if (pMatch) {
      const parts = pMatch[1]
        .trim()
        .split(/\s+(?:or|and|&)\s+|\s*,\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const part of parts) addAnchor(part);
      if (refTitles.length > 0) break;
    }
  }

  for (const anchor of KNOWN_ICONIC_ANCHORS) {
    if (refTitles.length >= 3) break;
    const canon = anchor.canonical.trim();
    const canonLower = canon.toLowerCase().replace(/^(a|an|the)\s+/, "");

    if (
      AMBIGUOUS_TITLES.has(canonLower) &&
      !isValidAmbiguousWord(canonLower, normRaw)
    ) {
      continue;
    }

    const canonRx = new RegExp(
      `\\b${canon.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    if (
      canonRx.test(cleanRaw) &&
      !refTitles.some((t) => t.toLowerCase() === canon.toLowerCase())
    ) {
      refTitles.push(canon);
    }
  }

  const wordList = cleanLower.split(/\s+/).filter(Boolean);
  const genericRx =
    /\b(recommend|suggest|show|give|want|looking|find|movie|movies|film|films|series|show|shows|anime|another|option|options|similar|more|live|action|sci-fi|scifi|dark|depressing|bleak|cute|wholesome|psychological|musical|western|silent|monochrome|drop|remove|relax|ignore|forget|clear|constraint|constraints|filter|filters|egyptian|kuwaiti|saudi|gulf|khaleeji|emirati|lebanese|syrian|arabic|arab|turkish|indian|bollywood|icelandic|swedish|danish|norwegian|finnish|polish|iranian|persian|korean|japanese|spanish|mexican|french|british|american|hollywood|theaters|theatres|cinemas|playing|director|directed|starring|actor|actress|rating|rated)\b/i;

  const rawStandalone = cleanRaw
    .replace(/[?.,!]/g, "")
    .replace(/^(?:movie|film|series|show|anime|watch)\s+/i, "")
    .trim();

  const cleanStandalone = rawStandalone
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, "")
    .trim();

  const isGreeting =
    CHAT_STOPWORDS.has(cleanStandalone) ||
    CHAT_STOPWORDS.has(lower.replace(/[?.,!]/g, "").trim());

  const isStopword =
    GENRE_STOPWORDS.has(cleanStandalone) ||
    GENRE_STOPWORDS.has(rawStandalone.toLowerCase()) ||
    Object.keys(genreMap).includes(cleanStandalone) ||
    Boolean(AMBIGUOUS_PERSON_MAP[cleanStandalone]);

  const standaloneAnchor =
    !isGreeting &&
    !isStopword &&
    !director &&
    actors.length === 0 &&
    !isNowPlaying &&
    !replacePrevious &&
    strictFormats.length === 0 &&
    origins.length === 0 &&
    wordList.length <= 6
      ? resolveFuzzyAnchorTitle(rawStandalone, normRaw)
      : null;

  const hasFilters =
    rawGenres.length > 0 ||
    keywords.length > 0 ||
    exGenres.length > 0 ||
    minYear !== null ||
    maxYear !== null ||
    minRating !== null ||
    lang !== null ||
    origins.length > 0 ||
    strictFormats.length > 0 ||
    replacePrevious ||
    noViolence ||
    director !== null ||
    actors.length > 0 ||
    isNowPlaying ||
    hasTwist ||
    hasSciFi ||
    isDarkComedy ||
    wantsDark;

  if (
    refTitles.length === 0 &&
    !director &&
    actors.length === 0 &&
    !isNowPlaying &&
    !isGreeting &&
    !isStopword &&
    wordList.length <= 6
  ) {
    const blockedAmbig =
      AMBIGUOUS_TITLES.has(cleanStandalone) &&
      !isValidAmbiguousWord(cleanStandalone, normRaw);

    if (!blockedAmbig) {
      if (standaloneAnchor) {
        refTitles.push(standaloneAnchor.canonical);
      } else if (!hasFilters && wordList.length <= 5) {
        if (
          rawStandalone.length >= 2 &&
          (!genericRx.test(rawStandalone) || isSingleWordTitle)
        ) {
          const fixed = correctTypos(rawStandalone);
          const secondPass = resolveFuzzyAnchorTitle(fixed, normRaw);
          refTitles.push(secondPass ? secondPass.canonical : fixed);
        }
      }
    }
  }

  const contradictionMsg = detectContradictions({
    rawDetectedGenres: rawGenres,
    excludedGenres: exGenres.filter((g) => !(noViolence && g === "horror")),
    isRomCom,
    isCuteAnimeRomCom: isCuteAnime,
    isSitcom,
    isPureComedy,
    isComfortComedy: isComfortCom,
    isMindBlowingAction: isMba,
    isCyberpunk,
    isPhilosophicalSciFi: isPhiloSciFi,
    isTrueCrimeDoc: isTrueCrime,
    isFamilyAnimation: isFamilyAnim,
    isHauntedHorror: isHaunted,
    wantsExplicitLiveAction: wantsLiveAction,
    wantsExplicitAnime: /\b(anime|manga)\b/i.test(posText),
    isAdaptationMentioned: isAdaptation,
    wantsClassic,
    minYear,
    maxYear,
    extractedReferenceTitles: refTitles,
    extractedDirector: director,
    actors,
    fullContextText: cleanRaw,
  });

  if (contradictionMsg) {
    return {
      isValid: true,
      hasContradiction: true,
      contradictionMessage: contradictionMsg,
      message: contradictionMsg,
      targetType: selectedType,
      detectedGenres: [],
      detectedKeywords: [],
      actors: [],
      extractedActors: [],
      extractedActor: null,
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: relaxed,
      replacePrevious,
      excludeViolence: noViolence,
      originalText: text,
    };
  }

  let genres = rawGenres.filter((g) => !exGenres.includes(g));

  if (wantsDark && !wantsComedy) {
    if (!genres.includes("drama") && !exGenres.includes("drama")) {
      genres.push("drama");
    }
    if (!exGenres.includes("comedy")) exGenres.push("comedy");
    if (!exGenres.includes("family")) exGenres.push("family");
  }

  const exGenreIds = [];
  exGenres.forEach((g) => {
    if (TMDB_GENRE_IDS.movie[g]) exGenreIds.push(TMDB_GENRE_IDS.movie[g]);
    if (TMDB_GENRE_IDS.tv[g]) exGenreIds.push(TMDB_GENRE_IDS.tv[g]);
  });

  if (isHaunted || isCrimeFam || isPureComedy || isSitcom) {
    genres = genres.filter((g) => g !== "family" && g !== "sports");
  }
  if (isPureComedy || isSitcom) genres = ["comedy"];
  if (isDarkComedy && !genres.includes("comedy")) genres.unshift("comedy");
  if (isHaunted && !genres.includes("horror")) genres.push("horror");
  if (isCrimeFam && !genres.includes("crime")) genres.push("crime");

  if (withoutDrama && !isPureComedy && !isSitcom && !isDarkComedy) {
    genres = genres.filter((g) => g !== "drama");
  }

  if (isMba && !isPureComedy && !isSitcom) {
    if (!genres.includes("action") && !exGenres.includes("action"))
      genres.push("action");
    if (!genres.includes("scifi") && !exGenres.includes("scifi"))
      genres.push("scifi");
  }

  if (isRomCom) {
    if (!genres.includes("comedy") && !exGenres.includes("comedy"))
      genres.push("comedy");
    if (!genres.includes("romance") && !exGenres.includes("romance"))
      genres.push("romance");
  }

  if (isDarkAnime) {
    genres = genres.filter((g) => g !== "comedy" && g !== "family");
  }

  if (isCuteAnime) {
    if (!genres.includes("romance")) genres.push("romance");
    if (!genres.includes("comedy")) genres.push("comedy");
    genres = genres.filter(
      (g) => g !== "sports" && g !== "action" && g !== "family",
    );
  }

  if (isSwordWar || isHistWar) {
    if (!genres.includes("war")) genres.push("war");
    if (!genres.includes("history")) genres.push("history");
    genres = genres.filter((g) => g !== "action");
  }

  if (isTrueCrime) {
    if (!genres.includes("documentary")) genres.push("documentary");
    genres = genres.filter((g) => g !== "crime" && g !== "mystery");
  }

  if (hasTwist && !genres.includes("mystery")) genres.push("mystery");
  if (isUnderdog && !genres.includes("drama")) genres.push("drama");

  if (isFamilyAnim) {
    if (!genres.includes("animation")) genres.push("animation");
    if (!genres.includes("family")) genres.push("family");
  }

  if (isCyberpunk && !genres.includes("scifi")) genres.push("scifi");

  if (isPhiloSciFi) {
    if (!genres.includes("scifi")) genres.push("scifi");
    if (!genres.includes("drama") && !exGenres.includes("drama"))
      genres.push("drama");
  }

  if (hasSciFi && !genres.includes("scifi")) genres.unshift("scifi");
  if (isComfortCom && !genres.includes("comedy")) genres.push("comedy");
  if ((isHeist || isCrimeFam) && !genres.includes("crime")) {
    genres.push("crime");
  }

  if (exGenres.includes("horror") && genres.includes("family")) {
    genres = ["family"];
  }

  if (director || actors.length > 0 || isNowPlaying) {
    rawGenres.forEach((g) => {
      if (!exGenres.includes(g) && !genres.includes(g)) genres.push(g);
    });
  }

  let finalSwordWar = isSwordWar;
  let finalDarkAnime = isDarkAnime;
  let finalCuteAnime = isCuteAnime;
  let finalPhiloSciFi = isPhiloSciFi;
  let finalMba = isMba;
  let finalCyberpunk = isCyberpunk;
  let finalCrimeFam = isCrimeFam;
  let finalPsych = isPsych;
  let finalHaunted = isHaunted;
  let finalSitcom = isSitcom;
  let finalPureCom = isPureComedy;
  let finalTwist = hasTwist;

  refTitles = refTitles.map((refTitle) => {
    const meta = resolveFuzzyAnchorTitle(refTitle, normRaw);
    if (meta) {
      if (
        meta.genre &&
        !genres.includes(meta.genre) &&
        !exGenres.includes(meta.genre)
      ) {
        genres.push(meta.genre);
      }
      if (meta.flag === "isSwordWarfare") finalSwordWar = true;
      if (meta.flag === "isDarkAnime") finalDarkAnime = true;
      if (meta.flag === "isCuteAnimeRomCom") finalCuteAnime = true;
      if (meta.flag === "isPhilosophicalSciFi") finalPhiloSciFi = true;
      if (meta.flag === "isMindBlowingAction") finalMba = true;
      if (meta.flag === "isCyberpunk") finalCyberpunk = true;
      if (meta.flag === "isCrimeFamily") finalCrimeFam = true;
      if (meta.flag === "isPsychologicalThriller") finalPsych = true;
      if (meta.flag === "isHauntedHorror") finalHaunted = true;
      if (meta.flag === "isSitcom") finalSitcom = true;
      if (meta.flag === "isPureComedy") finalPureCom = true;
      if (meta.flag === "hasTwistKeywords") finalTwist = true;
      return meta.canonical;
    }
    return refTitle;
  });

  const anchorTitles = [...refTitles];
  const primaryRef = refTitles[0] || null;

  const hasMovie = /\b(movie|movies|film|films)\b/i.test(posText);
  const hasSeries =
    /\b(series|show|shows|tv|sitcom|docuseries|docu-series|k-drama|kdrama)\b/i.test(
      posText,
    );

  let targetType = selectedType;
  let hasExplicitType = false;

  if (isNowPlaying) {
    targetType = "movie";
    hasExplicitType = true;
  } else if (wantsLiveAction) {
    targetType = hasMovie ? "movie" : "tv";
    hasExplicitType = true;
  } else if (finalSitcom && !wantsAnime) {
    targetType = "tv";
    hasExplicitType = true;
  } else if (wantsAnime) {
    targetType = "anime";
    hasExplicitType = true;
  } else if (hasMovie && !hasSeries) {
    targetType = "movie";
    hasExplicitType = true;
  } else if (hasSeries && !hasMovie) {
    targetType = "tv";
    hasExplicitType = true;
  }

  const hasPre1970 =
    !relaxed.dropEra &&
    ((minYear !== null && minYear < 1970) ||
      (maxYear !== null && maxYear < 1970));

  const isHyperSpecific = Boolean(
    (!relaxed.dropFormats && strictFormats.length > 0) ||
    (!relaxed.dropOrigins && origins.length > 1) ||
    hasPre1970,
  );

  const hasSpecifics =
    refTitles.length > 0 ||
    Boolean(director) ||
    actors.length > 0 ||
    isNowPlaying ||
    hasSciFi ||
    wantsDark ||
    isDarkComedy ||
    genres.length > 0 ||
    keywords.length > 0 ||
    exGenres.length > 0 ||
    exKeywords.length > 0 ||
    minYear !== null ||
    maxYear !== null ||
    minRating !== null ||
    Boolean(lang) ||
    Boolean(country) ||
    origins.length > 0 ||
    strictFormats.length > 0 ||
    isHyperSpecific ||
    replacePrevious ||
    noViolence ||
    keepEra ||
    keepPerson ||
    wantsLiveAction ||
    isKorean ||
    finalTwist ||
    isUnderdog ||
    finalSwordWar ||
    finalCrimeFam ||
    finalCuteAnime ||
    finalDarkAnime ||
    finalSitcom ||
    finalHaunted ||
    finalMba ||
    hasQualityFloor ||
    finalPureCom ||
    isComfortCom ||
    isHistWar ||
    isTrueCrime ||
    isFamilyAnim ||
    finalCyberpunk ||
    finalPhiloSciFi ||
    isHeist;

  const hasMediaSignal =
    hasSpecifics ||
    hasMovie ||
    hasSeries ||
    wantsAnime ||
    /\b(recommend|suggest|watch|watching|binge|cinema|theater|theatre|episode|season|cast|director|actor|actress|soundtrack|ending|plot|story|vibe|vibes|mood|feel[- ]?good|depressing|tragic|bleak|uplifting|cozy|lighthearted|light-hearted|intense|suspense|thrilling|scary|funny|sad|emotional|short|long|recent|latest|new|old|classic|vintage|masterpiece|underrated|overrated|hidden\s+gem|top|best)\b/i.test(
      posText,
    );

  const isNonMediaQuestion =
    /^(?:who|what|when|where|why|how)\b/i.test(posText) &&
    !hasSpecifics &&
    !hasMovie &&
    !hasSeries &&
    !wantsAnime &&
    !/\b(watch|recommend|suggest|cinema|theater|theatre)\b/i.test(posText);

  if (!hasMediaSignal || isNonMediaQuestion) {
    return {
      isValid: false,
      isOutOfScope: true,
      message:
        "I'm Drome, an AI specialized strictly in movies, TV series, and anime! I can't help with topics outside cinema, so tell me what genre, mood, or title you'd like to watch and I'll find great picks for you.",
      actors: [],
      extractedActors: [],
      anchorTitles: [],
      extractedReferenceTitles: [],
      extractedReferenceTitle: null,
      origins: [],
      strictFormats: [],
      isHyperSpecific: false,
      relaxedConstraints: relaxed,
      replacePrevious: false,
      excludeViolence: false,
      originalText: text,
    };
  }

  const isAmbiguous =
    reviewsCount >= 5 ||
    director ||
    actors.length > 0 ||
    isNowPlaying ||
    replacePrevious
      ? false
      : isGreeting ||
        (refTitles.length === 0 && !hasSpecifics && wordList.length > 3);

  return {
    isValid: true,
    isSmallTalk: false,
    needsClarification: false,
    hasContradiction: false,
    contradictionMessage: null,
    isAmbiguous,
    isPivot,
    replacePrevious,
    relaxedConstraints: relaxed,
    preservesAnaphoricEra: keepEra,
    preservesAnaphoricPerson: keepPerson,
    excludeViolence: noViolence,
    isLiveAction: wantsLiveAction,
    wantsExplicitAnime: wantsAnime,
    isNowPlaying: Boolean(isNowPlaying),
    extractedDirector: director,
    actors,
    extractedActors: actors,
    extractedActor: firstActor,
    targetType,
    hasExplicitTargetType: hasExplicitType,
    detectedGenres: genres,
    detectedKeywords: keywords,
    detectedLanguage: lang,
    detectedCountry: country,
    detectedRegionLabel: regionLabel,
    origins,
    strictFormats,
    isHyperSpecific,
    excludedGenres: exGenres,
    excludedGenreIds: Array.from(new Set(exGenreIds)),
    excludedKeywords: exKeywords,
    excludedTermsFromPrompt: exTerms,
    minYear,
    maxYear,
    minRating,
    isPure,
    withoutDrama,
    wantsClassic,
    wantsDark,
    isDarkComedy,
    isHorrorNight,
    isCrimeHeist,
    isCrimeFamily: finalCrimeFam,
    isHeistRobbery: isHeist,
    isPsychologicalThriller: finalPsych,
    isRomCom,
    isCuteAnimeRomCom: finalCuteAnime,
    isDarkAnime: finalDarkAnime,
    isSitcom: finalSitcom,
    isSwordWarfare: finalSwordWar,
    isHistoricalWar: isHistWar,
    isHauntedHorror: finalHaunted,
    isMindBlowingAction: finalMba,
    hasQualityFloor,
    isPureComedy: finalPureCom,
    isTrueCrimeDoc: isTrueCrime,
    isKorean,
    hasTwistKeywords: finalTwist,
    isUnderdog,
    isFamilyAnimation: isFamilyAnim,
    isCyberpunk: finalCyberpunk,
    isTiredMood: isTired,
    isComfortComedy: isComfortCom,
    isPhilosophicalSciFi: finalPhiloSciFi,
    anchorTitles,
    extractedReferenceTitles: refTitles,
    extractedReferenceTitle: primaryRef,
    originalText: text,
  };
};
