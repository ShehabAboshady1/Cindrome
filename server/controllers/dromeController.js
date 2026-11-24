import db from "../config/db.js";
import {
  CindromeEngine,
  GENRE_STOPWORDS,
  AMBIGUOUS_TITLES,
  TMDB_ID_TO_NAME,
  getFranchiseKey,
  isValidCtrlWord,
  extractActors,
  normalizePromptSpelling,
  getUserPreviousTexts,
  getSessionSeenIds,
  mergeContext,
} from "../services/cindromeEngine.js";
import {
  resolveKnownFuzzyTitle,
  selectBestAnchorMatch,
  enrichUserProfile,
  checkPersonFallback,
  resolveAnchorMedia,
  fetchCandidates,
} from "../services/tmdbService.js";
import {
  buildReplyMessage,
  formatRecCards,
  logEngineStats,
} from "../services/replyHelper.js";

export { getFranchiseKey, resolveKnownFuzzyTitle, selectBestAnchorMatch };

const dbContextCache = new Map();
const CACHE_TTL = 60 * 1000;

const getUserDbContext = async (uid, apiKey) => {
  const cached = dbContextCache.get(uid);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const [countRes, watchedRes, watchlistRes] = await Promise.all([
    db.query(
      "SELECT COUNT(*) FROM reviews WHERE user_id = $1 AND rating >= 4.0",
      [uid],
    ),
    db.query("SELECT tmdb_id FROM reviews WHERE user_id = $1", [uid]),
    db.query("SELECT tmdb_id FROM watchlist WHERE user_id = $1", [uid]),
  ]);

  const reviewsCount = parseInt(countRes.rows[0].count, 10);
  const watchedSet = new Set(watchedRes.rows.map((r) => Number(r.tmdb_id)));
  const watchlistSet = new Set(watchlistRes.rows.map((r) => Number(r.tmdb_id)));

  let profileStats = { genres: {}, keywords: {} };

  if (reviewsCount >= 5) {
    const [topReviews, favGenres] = await Promise.all([
      db.query(
        `SELECT tmdb_id, media_type, rating 
         FROM reviews 
         WHERE user_id = $1 AND rating >= 4.0 
         ORDER BY rating DESC, watch_date DESC 
         LIMIT 20`,
        [uid],
      ),
      db.query("SELECT genre FROM user_favorite_genres WHERE user_id = $1", [
        uid,
      ]),
    ]);

    profileStats = await enrichUserProfile(
      topReviews.rows,
      favGenres.rows,
      apiKey,
      uid,
      reviewsCount,
    );
  }

  const data = {
    reviewsCount,
    profileStats,
    watchedSet,
    watchlistSet,
  };

  dbContextCache.set(uid, { ts: Date.now(), data });
  return data;
};

export const processChat = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: "Please sign in to use Drome AI.",
      });
    }

    const { prompt, focusType = "mixed", history = [] } = req.body;
    if (!prompt || prompt.trim() === "") {
      return res.status(400).json({ error: "Please enter a message." });
    }

    const apiKey = process.env.TMDB_API_KEY;
    const rawPrompt = prompt.trim();
    const cleanPrompt = normalizePromptSpelling(rawPrompt);

    let focus = focusType.toLowerCase().trim();
    if (focus === "movies" || focus === "movies only") focus = "movie";
    if (
      focus === "series" ||
      focus === "series only" ||
      focus === "tv series only"
    ) {
      focus = "tv";
    }
    if (focus === "anime only") focus = "anime";

    if (/\b(live action|live-action)\b/i.test(cleanPrompt)) {
      focus = /\b(movie|movies|film|films)\b/i.test(cleanPrompt)
        ? "movie"
        : "tv";
    } else if (
      /\b(series|show|shows|tv|sitcom|k-drama|kdrama|docuseries|docu-series)\b/i.test(
        cleanPrompt,
      )
    ) {
      focus = "tv";
    } else if (/\b(movie|movies|film|films)\b/i.test(cleanPrompt)) {
      focus = "movie";
    } else if (/\b(anime|manga)\b/i.test(cleanPrompt)) {
      focus = "anime";
    }

    const uid = req.user.id;
    const { reviewsCount, profileStats, watchedSet, watchlistSet } =
      await getUserDbContext(uid, apiKey);

    const prevTexts = getUserPreviousTexts(history);

    let intent = CindromeEngine.parseQuery(rawPrompt, focus, reviewsCount);

    if (!intent.isValid) {
      return res.json({ success: true, message: intent.message, results: [] });
    }
    if (intent.isSmallTalk) {
      return res.json({
        success: true,
        message: intent.smallTalkMessage || intent.message,
        results: [],
      });
    }
    if (intent.needsClarification) {
      return res.json({
        success: true,
        message: intent.clarificationMessage || intent.message,
        results: [],
      });
    }

    const rawActors = extractActors(rawPrompt, intent.extractedDirector);
    if (rawActors.length > 0) {
      const merged = Array.from(
        new Set([...(intent.actors || []), ...rawActors]),
      );
      intent.actors = merged;
      intent.extractedActors = merged;
      intent.extractedActor = merged[0] || null;
      intent.isValid = true;
      intent.isAmbiguous = false;
    }

    if (intent.hasContradiction) {
      const msg = buildReplyMessage({
        rawPrompt,
        parsedIntent: intent,
        resultsCount: 0,
      });
      return res.json({ success: true, message: msg, results: [] });
    }

    const relaxed = intent.relaxedConstraints || {
      dropEra: false,
      dropFormats: false,
      dropOrigins: false,
      droppedGenres: [],
    };
    const isReplacing = Boolean(intent.replacePrevious || intent.isPivot);

    if (
      /\b(sci[- ]?fi|scifi|science\s+fiction)\b/i.test(cleanPrompt) &&
      !intent.excludedGenres?.includes("scifi") &&
      !relaxed.droppedGenres?.includes("scifi")
    ) {
      if (!intent.detectedGenres.includes("scifi")) {
        intent.detectedGenres.push("scifi");
      }
      intent.isAmbiguous = false;
      intent.isValid = true;
    }

    const hasPersonIntent =
      Boolean(intent.extractedDirector) ||
      (Array.isArray(intent.actors) && intent.actors.length > 0);

    const fuzzyTitle = intent.extractedReferenceTitle
      ? resolveKnownFuzzyTitle(intent.extractedReferenceTitle, cleanPrompt)
      : cleanPrompt.split(/\s+/).filter(Boolean).length <= 4 &&
          !intent.isHyperSpecific &&
          !isReplacing &&
          (!intent.strictFormats || intent.strictFormats.length === 0) &&
          (!intent.origins || intent.origins.length === 0)
        ? resolveKnownFuzzyTitle(rawPrompt, cleanPrompt)
        : null;

    if (fuzzyTitle && !hasPersonIntent && !intent.isNowPlaying) {
      if (
        !intent.extractedReferenceTitles ||
        intent.extractedReferenceTitles.length === 0
      ) {
        intent.extractedReferenceTitles = [fuzzyTitle.canonical];
      }
      intent.anchorTitles = [...intent.extractedReferenceTitles];
      intent.extractedReferenceTitle = intent.extractedReferenceTitles[0];

      if (
        fuzzyTitle.genre &&
        !intent.detectedGenres.includes(fuzzyTitle.genre) &&
        !intent.excludedGenres.includes(fuzzyTitle.genre)
      ) {
        intent.detectedGenres.push(fuzzyTitle.genre);
      }
      if (fuzzyTitle.flag) {
        intent[fuzzyTitle.flag] = true;
      }
      intent.isAmbiguous = false;
      intent.isValid = true;
    }

    if (prevTexts.length > 0) {
      intent = mergeContext(intent, prevTexts, cleanPrompt, focus);
    }

    if (intent.isNowPlaying) {
      intent.targetType = "movie";
      intent.hasExplicitTargetType = true;
    }

    if (!intent.isValid) {
      return res.json({ success: true, message: intent.message, results: [] });
    }

    if (intent.hasContradiction && prevTexts.length === 0) {
      const msg = buildReplyMessage({
        rawPrompt,
        parsedIntent: intent,
        resultsCount: 0,
      });
      return res.json({ success: true, message: msg, results: [] });
    }

    if (
      intent.isAmbiguous &&
      (!intent.extractedReferenceTitles ||
        intent.extractedReferenceTitles.length === 0) &&
      (!intent.anchorTitles || intent.anchorTitles.length === 0) &&
      !intent.extractedDirector &&
      (!intent.actors || intent.actors.length === 0) &&
      !intent.isNowPlaying &&
      !intent.isHyperSpecific &&
      prevTexts.length === 0
    ) {
      return res.json({
        success: true,
        message:
          "I couldn't quite catch the specific genre or mood you're looking for. Are you in the mood for Comedy, Action, Sci-Fi, Horror, or Drama? You can also name a title, actor, or director you love!",
        results: [],
      });
    }

    const isPre1980 = Boolean(
      (intent.minYear !== null && intent.minYear < 1980) ||
      (intent.maxYear !== null && intent.maxYear < 1980),
    );
    const isArabicQuery = Boolean(
      intent.detectedLanguage === "ar" ||
      intent.detectedCountry === "EG" ||
      (Array.isArray(intent.origins) &&
        intent.origins.some((o) =>
          [
            "Egyptian",
            "Arabic",
            "Kuwaiti",
            "Gulf/Saudi",
            "Lebanese",
            "Syrian",
            "Moroccan",
            "Tunisian",
            "Jordanian",
            "Iraqi",
            "Emirati",
          ].includes(o),
        )),
    );

    const hasActor = Array.isArray(intent.actors) && intent.actors.length > 0;
    const baseFloor = isPre1980 || isArabicQuery ? 5.5 : hasActor ? 6.0 : 6.8;
    const ratingFloor = Math.max(baseFloor, intent.minRating || baseFloor);

    const hasMultiOrigins =
      Array.isArray(intent.origins) && intent.origins.length > 1;
    const hasFormats =
      Array.isArray(intent.strictFormats) && intent.strictFormats.length > 0;
    const isPre1970 = Boolean(
      (intent.minYear !== null && intent.minYear < 1970) ||
      (intent.maxYear !== null && intent.maxYear < 1970),
    );
    const noFallback = Boolean(
      intent.isHyperSpecific || hasMultiOrigins || hasFormats || isPre1970,
    );

    if (hasMultiOrigins) {
      const msg = buildReplyMessage({
        rawPrompt,
        parsedIntent: intent,
        resultsCount: 0,
        topResultsRaw: [],
      });
      return res.json({ success: true, message: msg, results: [] });
    }

    const hasSimKeyword =
      /\b(like|similar\s+to|such\s+as|vibes?\s+of|in\s+the\s+style\s+of|after|watch\s+after|watched|finished|liked|loved|enjoyed|based\s+on|inspired\s+by)\b/i.test(
        rawPrompt,
      );

    let refTitles =
      Array.isArray(intent.anchorTitles) && intent.anchorTitles.length > 0
        ? [...intent.anchorTitles]
        : Array.isArray(intent.extractedReferenceTitles)
          ? [...intent.extractedReferenceTitles]
          : intent.extractedReferenceTitle
            ? [intent.extractedReferenceTitle]
            : [];

    if (
      intent.extractedDirector ||
      (intent.actors && intent.actors.length > 0) ||
      intent.isNowPlaying ||
      hasFormats
    ) {
      refTitles = [];
    }

    refTitles = refTitles
      .filter((t) => {
        if (!t) return false;
        const clean = t
          .toLowerCase()
          .trim()
          .replace(/^(a|an|the)\s+/, "");
        if (
          AMBIGUOUS_TITLES &&
          AMBIGUOUS_TITLES.has(clean) &&
          !isValidCtrlWord(clean, cleanPrompt)
        ) {
          return false;
        }
        return (
          !GENRE_STOPWORDS.has(clean) &&
          !GENRE_STOPWORDS.has(t.toLowerCase().trim())
        );
      })
      .slice(0, 3);

    const shortCandidate = cleanPrompt
      .toLowerCase()
      .replace(/[?.,!]/g, "")
      .trim()
      .replace(/^(a|an|the)\s+/, "");

    const isAmbiguousShort =
      AMBIGUOUS_TITLES &&
      AMBIGUOUS_TITLES.has(shortCandidate) &&
      isValidCtrlWord(shortCandidate, cleanPrompt);

    const isShortTitle =
      cleanPrompt.split(" ").length <= 5 &&
      !intent.extractedDirector &&
      (!intent.actors || intent.actors.length === 0) &&
      !intent.isNowPlaying &&
      !intent.isHyperSpecific &&
      !isReplacing &&
      !hasFormats &&
      !intent.detectedLanguage &&
      !intent.detectedCountry &&
      intent.detectedGenres.length === 0 &&
      intent.detectedKeywords.length === 0 &&
      (!/\b(recommend|suggest|show|give|want|looking|find|movies|anime|series|dark|psychological|cute|wholesome|musical|western|silent|monochrome|egyptian|kuwaiti|saudi|turkish|korean|japanese|indian|bollywood|icelandic|arabic|french|spanish)\b/i.test(
        cleanPrompt,
      ) ||
        isAmbiguousShort);

    if (
      refTitles.length === 1 &&
      (!intent.actors || intent.actors.length === 0) &&
      !intent.extractedDirector &&
      !hasSimKeyword
    ) {
      const person = await checkPersonFallback(
        refTitles[0],
        cleanPrompt,
        apiKey,
      );
      if (person) {
        if (person.known_for_department === "Directing") {
          intent.extractedDirector = person.name;
        } else {
          intent.actors = [person.name];
          intent.extractedActors = [person.name];
          intent.extractedActor = person.name;
        }
        refTitles = [];
        intent.extractedReferenceTitles = [];
        intent.anchorTitles = [];
        intent.extractedReferenceTitle = null;
      }
    }

    if (
      refTitles.length === 0 &&
      isShortTitle &&
      !intent.extractedDirector &&
      (!intent.actors || intent.actors.length === 0)
    ) {
      const shortCheck = cleanPrompt
        .toLowerCase()
        .trim()
        .replace(/^(a|an|the)\s+/, "");
      const blocked =
        AMBIGUOUS_TITLES &&
        AMBIGUOUS_TITLES.has(shortCheck) &&
        !isValidCtrlWord(shortCheck, cleanPrompt);

      if (
        !blocked &&
        !GENRE_STOPWORDS.has(shortCheck) &&
        !GENRE_STOPWORDS.has(cleanPrompt.toLowerCase().trim())
      ) {
        refTitles.push(cleanPrompt);
      }
    }

    const isStandaloneAnchor =
      refTitles.length === 1 &&
      !hasSimKeyword &&
      rawPrompt.split(/\s+/).filter(Boolean).length <= 6;

    const resolvedRaw = await Promise.all(
      refTitles.map((t) => resolveAnchorMedia(t, intent, cleanPrompt, apiKey)),
    );
    const anchors = resolvedRaw.filter(Boolean);

    anchors.forEach((anchorObj) => {
      if (
        anchorObj.media?.genre_ids &&
        Array.isArray(anchorObj.media.genre_ids)
      ) {
        const gNames = anchorObj.media.genre_ids
          .map((id) => TMDB_ID_TO_NAME[id]?.toLowerCase())
          .filter(Boolean)
          .filter((g) => !intent.excludedGenres.includes(g));

        intent.detectedGenres = Array.from(
          new Set([...(intent.detectedGenres || []), ...gNames]),
        );

        if (
          (anchorObj.media.genre_ids.includes(878) ||
            anchorObj.media.genre_ids.includes(10765)) &&
          !intent.detectedGenres.includes("scifi") &&
          !intent.excludedGenres.includes("scifi")
        ) {
          intent.detectedGenres.push("scifi");
        }
      }

      if (anchorObj.meta) {
        if (
          anchorObj.meta.genre &&
          !intent.detectedGenres.includes(anchorObj.meta.genre) &&
          !intent.excludedGenres.includes(anchorObj.meta.genre)
        ) {
          intent.detectedGenres.push(anchorObj.meta.genre);
        }
        if (anchorObj.meta.flag) {
          intent[anchorObj.meta.flag] = true;
        }
      }
    });

    const anchorNames = anchors.map((a) => a.title);
    const primaryAnchor = anchorNames[0] || null;
    const anchorMedia = anchors.find((a) => a.media !== null)?.media || null;

    intent.extractedReferenceTitles = anchorNames;
    intent.anchorTitles = anchorNames;
    intent.extractedReferenceTitle = primaryAnchor;

    const hasQuality =
      intent.hasQualityFloor ||
      intent.isMindBlowingAction ||
      intent.isPureComedy ||
      /\b(mind[- ]blowing|mind blowing|masterpiece|masterpieces|epic|best|top[- ]tier|greatest)\b/i.test(
        cleanPrompt,
      );

    const hasSpecifics =
      anchorNames.length > 0 ||
      Boolean(primaryAnchor) ||
      Boolean(anchorMedia) ||
      Boolean(intent.extractedDirector) ||
      (Array.isArray(intent.actors) && intent.actors.length > 0) ||
      Boolean(intent.isNowPlaying) ||
      Boolean(intent.isHyperSpecific) ||
      Boolean(intent.excludeViolence) ||
      hasFormats ||
      intent.detectedGenres.length > 0 ||
      intent.detectedKeywords.length > 0 ||
      (intent.excludedGenres && intent.excludedGenres.length > 0) ||
      (intent.excludedKeywords && intent.excludedKeywords.length > 0) ||
      intent.minYear !== null ||
      intent.maxYear !== null ||
      intent.minRating !== null ||
      Boolean(intent.detectedLanguage) ||
      Boolean(intent.detectedCountry) ||
      intent.isKorean ||
      intent.hasTwistKeywords ||
      intent.isUnderdog ||
      intent.isSwordWarfare ||
      intent.isCrimeFamily ||
      intent.isCuteAnimeRomCom ||
      intent.isDarkAnime ||
      intent.isDarkComedy ||
      intent.isSitcom ||
      intent.isHauntedHorror ||
      intent.isMindBlowingAction ||
      hasQuality ||
      intent.isPureComedy ||
      intent.isComfortComedy ||
      intent.isHistoricalWar ||
      intent.isTrueCrimeDoc ||
      intent.isFamilyAnimation ||
      intent.isCyberpunk ||
      intent.isPhilosophicalSciFi ||
      intent.isHeistRobbery;

    if (
      reviewsCount < 3 &&
      anchorNames.length === 0 &&
      !hasSpecifics &&
      prevTexts.length === 0
    ) {
      const msg = buildReplyMessage({
        rawPrompt,
        parsedIntent: intent,
        resultsCount: 0,
        isColdStart: true,
      });
      return res.json({ success: true, message: msg, results: [] });
    }

    const seenIds = getSessionSeenIds(history);
    const getWatchedIdsFn = async () => watchedSet;

    const {
      candidates,
      resolvedDirectorId,
      resolvedActorIds,
      resolvedActorNames,
      requestedActorsList,
      hasExplicitActorRequest,
      isSitcomIntent,
    } = await fetchCandidates({
      parsedIntent: intent,
      cleanPrompt,
      normalizedFocus: focus,
      resolvedAnchors: anchors,
      effectiveRatingFloor: ratingFloor,
      isClassicPre1980Era: isPre1980,
      isArabicOrEgyptianQuery: isArabicQuery,
      hasStrictFormats: hasFormats,
      hasPre1970Era: isPre1970,
      isStrictNoFallbackQuery: noFallback,
      tmdbApiKey: apiKey,
      getWatchedIdsFn,
      sessionSeenIds: seenIds,
    });

    const finalFloor = hasExplicitActorRequest
      ? Math.max(6.0, intent.minRating || 6.0)
      : ratingFloor;

    const ranked = CindromeEngine.scoreAndRank(
      candidates,
      intent,
      profileStats,
      anchorNames,
      reviewsCount,
    );

    let eligible = ranked.filter(
      (item) => item.finalScore >= 40 && (item.vote_average || 0) >= finalFloor,
    );

    if (eligible.length < 4) {
      const midTier = ranked.filter(
        (item) =>
          item.finalScore >= 25 && (item.vote_average || 0) >= finalFloor,
      );
      if (midTier.length >= eligible.length) {
        eligible = midTier;
      }
    }

    if (eligible.length < 4 && ranked.length > 0) {
      const lowTier = ranked.filter(
        (item) =>
          (item.vote_average || 0) >= finalFloor &&
          (item.finalScore >= 15 ||
            item.isActorMatch ||
            isPre1980 ||
            isArabicQuery),
      );
      if (lowTier.length > eligible.length) {
        eligible = lowTier;
      }
    }

    let topPicks = [];
    const deduped = [];
    const seenFranchises = new Set();

    anchorNames.forEach((name) => {
      if (name) seenFranchises.add(getFranchiseKey(name));
    });

    for (const item of eligible) {
      const fKey = getFranchiseKey(item.title || item.name);
      if (!seenFranchises.has(fKey)) {
        seenFranchises.add(fKey);
        deduped.push(item);
      }
    }

    if (intent.targetType === "mixed") {
      const isMovieAnchor =
        anchorMedia &&
        (anchorMedia.media_type === "movie" ||
          (!anchorMedia.first_air_date && anchorMedia.release_date));

      if (
        isMovieAnchor ||
        intent.extractedDirector ||
        hasExplicitActorRequest ||
        intent.isNowPlaying ||
        noFallback ||
        isPre1980 ||
        isArabicQuery ||
        ((anchorMedia || anchorNames.length > 0) && !isSitcomIntent)
      ) {
        topPicks.push(...deduped.slice(0, 4));
      } else if (isSitcomIntent) {
        const seriesOnly = deduped.filter((item) => item.media_type === "tv");
        topPicks.push(...seriesOnly.slice(0, 4));
        if (topPicks.length < 4) {
          for (const item of deduped) {
            if (topPicks.length >= 4) break;
            if (!topPicks.some((p) => p.id === item.id)) {
              topPicks.push(item);
            }
          }
        }
      } else {
        const movies = deduped.filter((item) => item.media_type === "movie");
        const series = deduped.filter((item) => item.media_type === "tv");

        topPicks.push(...movies.slice(0, 2));
        topPicks.push(...series.slice(0, 2));

        if (topPicks.length < 4) {
          for (const item of deduped) {
            if (topPicks.length >= 4) break;
            if (!topPicks.some((p) => p.id === item.id)) {
              topPicks.push(item);
            }
          }
        }
      }
      topPicks.sort((a, b) => b.finalScore - a.finalScore);
    } else {
      topPicks = deduped.slice(0, 4);
    }

    if (topPicks.length < 4) {
      for (const item of ranked) {
        if (topPicks.length >= 4) break;
        if ((item.vote_average || 0) < finalFloor) continue;
        if (
          item.finalScore < 20 &&
          !item.isActorMatch &&
          !isPre1980 &&
          !isArabicQuery
        ) {
          continue;
        }

        const fKey = getFranchiseKey(item.title || item.name);
        if (
          !topPicks.some((p) => p.id === item.id) &&
          !seenFranchises.has(fKey)
        ) {
          topPicks.push(item);
          seenFranchises.add(fKey);
        }
      }
    }

    topPicks = topPicks.map((item) =>
      item.raw_vote_average !== undefined
        ? { ...item, vote_average: item.raw_vote_average }
        : item,
    );

    logEngineStats({
      currentUserId: uid,
      userReviewsCount: reviewsCount,
      resolvedAnchorNames: anchorNames,
      isStandaloneAnchorSearch: isStandaloneAnchor,
      parsedIntent: intent,
      resolvedDirectorId,
      resolvedActorNames,
      resolvedActorIds,
      requestedActorsList,
      hasExplicitActorRequest,
      hasStrictFormats: hasFormats,
      effectiveRatingFloor: finalFloor,
      sessionSeenIds: seenIds,
      userProfileStats: profileStats,
      topResultsRaw: topPicks,
    });

    const cards = formatRecCards(topPicks, watchlistSet);

    const replyMsg = buildReplyMessage({
      rawPrompt,
      parsedIntent: intent,
      resultsCount: cards.length,
      topResultsRaw: topPicks,
      isColdStart: false,
      resolvedAnchorNames: anchorNames,
      rawAnchorInputs: refTitles,
      isStandaloneAnchorSearch: isStandaloneAnchor,
      resolvedActorNames:
        resolvedActorNames.length > 0
          ? resolvedActorNames
          : requestedActorsList,
    });

    return res.json({
      success: true,
      message: replyMsg,
      results: cards,
    });
  } catch (err) {
    console.error("Drome Controller Error:", err);
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }
};

export default processChat;
