import { TMDB_GENRE_IDS } from "./engine/constants.js";
import { getSimilarityScore } from "./engine/textHelper.js";

const getMicroGenreLabel = (intent, fallback) => {
  if (!intent) return fallback;
  if (intent.isDarkComedy) return "dark comedy";
  if (intent.isHauntedHorror) return "haunted house horror";
  if (intent.isCyberpunk) return "cyberpunk Sci-Fi";
  if (intent.isPhilosophicalSciFi) return "philosophical Sci-Fi";
  if (intent.isPsychologicalThriller) return "psychological thriller";
  if (intent.isTrueCrimeDoc) return "true crime documentary";
  if (intent.isHeistRobbery) return "heist crime";
  if (intent.isCrimeFamily) return "organized crime";
  if (intent.isSwordWarfare) return "ancient sword warfare";
  if (intent.isSitcom) return "sitcom comedy";
  if (intent.isCuteAnimeRomCom) return "wholesome rom-com";
  if (intent.isDarkAnime) return "dark fantasy";
  if (intent.isRomCom) return "romantic comedy";
  return fallback;
};

export const generateResponseText = (
  intent,
  count,
  isColdStart = false,
  anchors = null,
) => {
  if (intent?.isSmallTalk && intent?.smallTalkMessage) {
    return intent.smallTalkMessage;
  }

  if (intent?.needsClarification && intent?.clarificationMessage) {
    return intent.clarificationMessage;
  }

  if (intent?.hasContradiction && intent?.contradictionMessage) {
    return intent.contradictionMessage.replace(/\*\*/g, "");
  }

  const formatGenre = (g) => (g === "scifi" ? "Sci-Fi" : g);

  const anchorList = (
    Array.isArray(anchors)
      ? anchors
      : anchors
        ? [anchors]
        : intent?.anchorTitles || intent?.extractedReferenceTitles || []
  ).filter(Boolean);

  const actorList = (
    Array.isArray(intent?.actors)
      ? intent.actors
      : Array.isArray(intent?.extractedActors)
        ? intent.extractedActors
        : intent?.extractedActor
          ? [intent.extractedActor]
          : []
  ).filter(Boolean);

  const region = intent?.detectedRegionLabel
    ? `${intent.detectedRegionLabel} `
    : "";

  const genres =
    intent?.detectedGenres?.length > 0
      ? intent.detectedGenres.map(formatGenre)
      : [];

  const baseGenre = genres.length > 0 ? genres.join(" and ") : "top";
  const genreLabel = getMicroGenreLabel(intent, baseGenre);

  const isPlural = count === undefined || count === null || count !== 1;
  const target = intent?.targetType || "mixed";

  let typeLabel = "titles";
  if (target === "movie") typeLabel = isPlural ? "movies" : "movie";
  else if (target === "tv") typeLabel = "series";
  else if (target === "anime") typeLabel = "anime";
  else typeLabel = isPlural ? "titles" : "title";

  const singularType =
    target === "movie"
      ? "movie"
      : target === "tv"
        ? "series"
        : target === "anime"
          ? "anime"
          : "title";

  const ratingTag = intent?.minRating ? ` rated ${intent.minRating}+` : "";

  if (isColdStart) {
    const pluralMedia =
      target === "movie"
        ? "movies"
        : target === "tv"
          ? "series"
          : target === "anime"
            ? "anime"
            : "titles";
    return `I see your watch history for ${pluralMedia} is still brand new! To help me tailor my recommendations, what is a specific ${singularType} that you consider a masterpiece or always love watching?`;
  }

  if (count === 0) {
    return "I searched my database with those specific constraints, but couldn't find a strong match. Try broadening your request or naming a favorite title!";
  }

  if (intent?.isNowPlaying) {
    const noun = isPlural ? "movies" : "movie";
    return `Here ${isPlural ? "are" : "is"} the top ${region}${genreLabel !== "top" ? genreLabel + " " : ""}${noun} currently playing in theaters${ratingTag}:`;
  }

  if (intent?.extractedDirector && actorList.length > 0) {
    return `Here ${isPlural ? "are" : "is"} the highest-rated ${region}${genreLabel !== "top" ? genreLabel + " " : ""}${typeLabel} directed by ${intent.extractedDirector} starring ${actorList.join(" and ")}${ratingTag}:`;
  }

  if (intent?.extractedDirector) {
    return `Here ${isPlural ? "are" : "is"} the highest-rated ${region}${genreLabel !== "top" ? genreLabel + " " : ""}${typeLabel} directed by ${intent.extractedDirector}${ratingTag}:`;
  }

  if (actorList.length > 0) {
    return `Here ${isPlural ? "are" : "is"} the highest-rated ${region}${genreLabel !== "top" ? genreLabel + " " : ""}${typeLabel} starring ${actorList.join(" and ")}${ratingTag}:`;
  }

  if (anchorList.length > 1) {
    const titlesText = anchorList.map((t) => `"${t}"`).join(" and ");
    const tone = genres.length > 0 ? genres[0] : "cinematic";
    return `Great picks with ${titlesText}! I've blended their ${tone} tone and pacing while filtering out direct sequels. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"}${ratingTag}:`;
  }

  if (anchorList.length === 1) {
    const tone = genres.length > 0 ? genres[0] : "cinematic";
    return `Great pick with "${anchorList[0]}"! I've filtered out direct sequels and matched its exact ${tone} tone and pacing. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"} for you${ratingTag}:`;
  }

  const desc = `${region}${genreLabel} ${typeLabel}${ratingTag}`.trim();
  const recNoun = isPlural ? "recommendations" : "recommendation";
  const matchNoun = isPlural ? "matches" : "match";

  const templates = [
    `Based on your request for ${desc}, and factoring in your preferences, here ${isPlural ? "are" : "is"} the top-rated ${recNoun}:`,
    `Here ${isPlural ? "are some" : "is a"} top-tier ${desc} that ${isPlural ? "match" : "matches"} your requested tone and focus:`,
    `I've analyzed titles matching your search for ${desc} and ranked ${isPlural ? "these as your best matches" : `this as your best ${matchNoun}`}:`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
};

export const buildReplyMessage = ({
  rawPrompt,
  parsedIntent: intent,
  resultsCount: count,
  topResultsRaw = [],
  isColdStart = false,
  resolvedAnchorNames = [],
  rawAnchorInputs = [],
  isStandaloneAnchorSearch = false,
  resolvedActorNames = [],
}) => {
  const formatGenre = (g) => (g === "scifi" ? "Sci-Fi" : g);

  if (intent?.isSmallTalk && intent?.smallTalkMessage) {
    return intent.smallTalkMessage;
  }

  if (intent?.needsClarification && intent?.clarificationMessage) {
    return intent.clarificationMessage;
  }

  if (intent?.hasContradiction && intent?.contradictionMessage) {
    return intent.contradictionMessage.replace(/\*\*/g, "");
  }

  const isPlural = count === undefined || count === null || count !== 1;

  if (isColdStart) {
    return generateResponseText(intent, 0, true, resolvedAnchorNames);
  }

  const actors =
    resolvedActorNames.length > 0
      ? resolvedActorNames
      : Array.isArray(intent?.actors)
        ? intent.actors
        : [];

  if (count === 0) {
    const parts = [];

    if (
      Array.isArray(intent?.strictFormats) &&
      intent.strictFormats.length > 0
    ) {
      parts.push(intent.strictFormats.join(" / "));
    }

    if (Array.isArray(intent?.origins) && intent.origins.length > 0) {
      parts.push(intent.origins.join(" + "));
    } else if (intent?.detectedRegionLabel) {
      parts.push(intent.detectedRegionLabel);
    }

    if (
      Array.isArray(intent?.detectedGenres) &&
      intent.detectedGenres.length > 0
    ) {
      parts.push(intent.detectedGenres.map(formatGenre).join(" / "));
    }

    const target = intent?.targetType || "mixed";
    const typeLabel =
      target === "movie"
        ? "movies"
        : target === "tv"
          ? "series"
          : target === "anime"
            ? "anime"
            : "titles";
    parts.push(typeLabel);

    if (intent?.extractedDirector) {
      parts.push(`directed by ${intent.extractedDirector}`);
    }

    if (actors.length > 0) {
      parts.push(`starring ${actors.join(" and ")}`);
    }

    if (
      intent?.minYear !== null &&
      intent?.minYear !== undefined &&
      intent?.maxYear !== null &&
      intent?.maxYear !== undefined
    ) {
      if (intent.minYear === intent.maxYear) {
        parts.push(`from ${intent.minYear}`);
      } else {
        parts.push(`from ${intent.minYear}–${intent.maxYear}`);
      }
    } else if (intent?.minYear !== null && intent?.minYear !== undefined) {
      parts.push(`released after ${intent.minYear}`);
    } else if (intent?.maxYear !== null && intent?.maxYear !== undefined) {
      parts.push(`released before ${intent.maxYear + 1}`);
    }

    if (intent?.minRating) {
      parts.push(`rated ${intent.minRating}+`);
    }

    const summary = parts.join(" ").replace(/\s+/g, " ").trim();

    if (
      intent?.isHyperSpecific ||
      (intent?.origins && intent.origins.length > 1) ||
      (intent?.strictFormats && intent.strictFormats.length > 0) ||
      actors.length > 0 ||
      intent?.extractedDirector ||
      intent?.minYear !== null ||
      intent?.maxYear !== null
    ) {
      return `I searched my database for ${summary}, but no titles matched that exact combination of constraints. Try relaxing the era, origin, format, or genre filters!`;
    }

    return "I searched my database with those exact constraints, but couldn't find a strong match. Try broadening your filters or naming a title you love!";
  }

  const presentIds = new Set();
  if (Array.isArray(topResultsRaw)) {
    topResultsRaw.forEach((item) => {
      (item.genre_ids || []).forEach((id) => presentIds.add(Number(id)));
    });
  }

  const verifiedGenres = (intent?.detectedGenres || []).filter((g) => {
    if (presentIds.size === 0) return true;
    if (g === "sports") return true;
    const mId = TMDB_GENRE_IDS.movie[g];
    const tId = TMDB_GENRE_IDS.tv[g];
    if (g === "scifi") {
      return presentIds.has(878) || presentIds.has(10765);
    }
    return (
      (mId && presentIds.has(Number(mId))) ||
      (tId && presentIds.has(Number(tId)))
    );
  });

  const displayGenres = verifiedGenres.map(formatGenre);
  const ratingTag = intent?.minRating ? ` rated ${intent.minRating}+` : "";

  if (isStandaloneAnchorSearch && resolvedAnchorNames.length === 1) {
    const title = resolvedAnchorNames[0];
    const rawTyped = (rawAnchorInputs[0] || rawPrompt || "")
      .replace(/[?.,!]/g, "")
      .trim();
    const cleanRaw = rawTyped.toLowerCase().replace(/^(a|an|the)\s+/, "");
    const cleanTitle = title.toLowerCase().replace(/^(a|an|the)\s+/, "");
    const corrected =
      cleanRaw.length >= 2 &&
      cleanRaw !== cleanTitle &&
      getSimilarityScore(cleanRaw, cleanTitle) < 0.99;

    const tone = displayGenres.length > 0 ? displayGenres[0] : "cinematic";

    if (corrected) {
      return `It looks like you meant "${title}"! Assuming you're looking for similar titles, I've matched its ${tone} vibe and filtered out direct sequels. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"}${ratingTag}:`;
    }
    return `Great pick with "${title}"! Assuming you're looking for similar titles, I've matched its exact ${tone} tone and pacing while filtering out direct sequels. Here ${isPlural ? "are my top recommendations" : "is my top recommendation"} for you${ratingTag}:`;
  }

  return generateResponseText(
    {
      ...intent,
      detectedGenres: verifiedGenres,
      actors,
      extractedActors: actors,
    },
    count,
    isColdStart,
    resolvedAnchorNames,
  );
};

export const formatRecCards = (items = [], watchlistSet = new Set()) => {
  return items.map((item) => {
    const isAnime =
      item.media_type === "anime" ||
      (item.original_language === "ja" && item.genre_ids?.includes(16));
    const isTv =
      !isAnime && (item.media_type === "tv" || Boolean(item.first_air_date));

    const mediaType = isAnime ? "anime" : isTv ? "tv" : "movie";
    const year =
      (item.release_date || item.first_air_date || "").split("-")[0] || "N/A";

    return {
      id: Number(item.id),
      title: item.title || item.name || "Untitled",
      poster: item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "/assets/posters/default-poster.png",
      score:
        typeof item.vote_average === "number" && item.vote_average > 0
          ? item.vote_average.toFixed(1)
          : "NR",
      mediaType,
      meta: year,
      inWatchlist: watchlistSet.has(Number(item.id)),
    };
  });
};

export const logEngineStats = ({
  currentUserId: uid,
  userReviewsCount: reviewsCount,
  resolvedAnchorNames = [],
  isStandaloneAnchorSearch = false,
  parsedIntent: intent,
  resolvedDirectorId = null,
  resolvedActorNames = [],
  resolvedActorIds = [],
  requestedActorsList = [],
  hasExplicitActorRequest = false,
  hasStrictFormats = false,
  effectiveRatingFloor = 6.8,
  sessionSeenIds = new Set(),
  userProfileStats = { genres: {}, keywords: {} },
  topResultsRaw = [],
}) => {
  const intentW = reviewsCount >= 10 ? "40" : reviewsCount >= 5 ? "50" : "60";
  const userW = reviewsCount >= 10 ? "35" : reviewsCount >= 5 ? "15" : "0";
  const ratingW = reviewsCount >= 10 ? "25" : reviewsCount >= 5 ? "35" : "40";
  const line = "-".repeat(76);

  console.log(`\n${line}`);
  console.log(
    ` CINDROME ENGINE  |  User #${uid} (${reviewsCount} reviews)  |  Weights: ${intentW} / ${userW} / ${ratingW}`,
  );
  console.log(line);

  if (resolvedAnchorNames.length > 0) {
    console.log(
      ` Anchor   : ${resolvedAnchorNames.map((n) => `"${n}"`).join(", ")}${isStandaloneAnchorSearch ? " (Standalone)" : ""}`,
    );
  }
  if (intent.extractedDirector) {
    console.log(
      ` Director : "${intent.extractedDirector}" (ID: ${resolvedDirectorId || "N/A"})`,
    );
  }
  if (resolvedActorNames.length > 0 || hasExplicitActorRequest) {
    const actors =
      resolvedActorNames.length > 0 ? resolvedActorNames : requestedActorsList;
    console.log(
      ` Actors   : ${actors.map((n, i) => `"${n}" (${resolvedActorIds[i] || "N/A"})`).join(", ")}`,
    );
  }

  const filters = [
    `Rating >= ${effectiveRatingFloor}`,
    `Seen Excluded: ${sessionSeenIds.size}`,
  ];
  if (intent.minYear !== null || intent.maxYear !== null) {
    filters.push(`Era: ${intent.minYear || "Any"}-${intent.maxYear || "Now"}`);
  }
  if (intent.detectedLanguage || intent.detectedCountry) {
    filters.push(
      `Origin: ${intent.detectedRegionLabel || intent.detectedCountry || intent.detectedLanguage}`,
    );
  }
  if (hasStrictFormats) {
    filters.push(`Format: ${intent.strictFormats.join("/")}`);
  }
  if (intent.excludeViolence) filters.push("Mode: PG-13 Safe");
  if (intent.isNowPlaying) filters.push("Mode: In Theaters");
  console.log(` Filters  : ${filters.join("  |  ")}`);

  if (
    (intent.excludedGenres && intent.excludedGenres.length > 0) ||
    (intent.excludedTermsFromPrompt &&
      intent.excludedTermsFromPrompt.length > 0)
  ) {
    const excluded = [
      ...(intent.excludedGenres || []),
      ...(intent.excludedTermsFromPrompt || []),
    ];
    console.log(` Excluded : ${excluded.join(", ")}`);
  }

  const topKws = Object.keys(userProfileStats.keywords || {}).slice(0, 5);
  if (topKws.length > 0) {
    console.log(` User Kws : ${topKws.join(", ")}`);
  }

  console.log(line);
  console.log(
    ` #   ${"Title".padEnd(24)} ${"Final".padEnd(8)} ${"Intent".padEnd(8)} ${"User".padEnd(7)} ${"Rating".padEnd(8)} Matched`,
  );
  console.log(line);

  if (topResultsRaw.length === 0) {
    console.log("     No matching recommendations found for this query.");
  } else {
    topResultsRaw.slice(0, 4).forEach((item, idx) => {
      const rawTitle = item.title || item.name || "Unknown";
      const title =
        rawTitle.length > 22 ? `${rawTitle.slice(0, 21)}…` : rawTitle;
      const finalCol = (item.finalScore ?? 0).toFixed(1).padEnd(8);
      const intentCol = Math.round(item.breakdown?.s_intent ?? 0)
        .toString()
        .padEnd(8);
      const userCol = Math.round(item.breakdown?.s_user ?? 50)
        .toString()
        .padEnd(7);
      const ratingCol = Math.round(item.breakdown?.s_rating ?? 0)
        .toString()
        .padEnd(8);
      const kwMatches = (item.breakdown?.matched_user_keywords || [])
        .slice(0, 2)
        .join(", ");

      console.log(
        ` ${idx + 1}.  ${title.padEnd(24)} ${finalCol} ${intentCol} ${userCol} ${ratingCol} ${kwMatches || "-"}`,
      );
    });
  }

  console.log(`${line}\n`);
};
