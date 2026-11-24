import {
  KNOWN_DIRECTORS,
  KNOWN_ACTORS,
  NON_DIRECTOR_WORDS,
  NON_ACTOR_WORDS,
  CHAT_STOPWORDS,
  REGION_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_TITLES,
  GENRE_MOOD_WORDS,
  CTRL_MOOD_WORDS,
  ENGINE_LEXICON,
  COMMON_TYPOS_MAP,
  MULTI_WORD_ANCHOR_TYPOS,
  GENRE_STOPWORDS,
  genreMap,
  themeKeywords,
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
  normalizeInput,
  getFranchiseKey,
  cleanAnchorQuery,
  isValidAmbiguousWord,
  isValidCtrlWord,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  resolveFuzzyActor,
  extractActors,
  normalizePromptSpelling,
  correctTypos,
} from "./engine/textHelper.js";

import { detectContradictions, parseQuery } from "./engine/queryParser.js";
import { scoreAndRank } from "./engine/scoring.js";
import {
  getUserPreviousTexts,
  getSessionSeenIds,
  mergeContext,
  mergeHistoryContext,
} from "./engine/chatContext.js";
import {
  generateResponseText,
  buildReplyMessage,
  formatRecCards,
  logEngineStats,
} from "./replyHelper.js";

export {
  KNOWN_DIRECTORS,
  KNOWN_ACTORS,
  NON_DIRECTOR_WORDS,
  NON_ACTOR_WORDS,
  CHAT_STOPWORDS,
  REGION_MAP,
  KNOWN_ICONIC_ANCHORS,
  AMBIGUOUS_TITLES,
  GENRE_MOOD_WORDS,
  CTRL_MOOD_WORDS,
  ENGINE_LEXICON,
  COMMON_TYPOS_MAP,
  MULTI_WORD_ANCHOR_TYPOS,
  GENRE_STOPWORDS,
  genreMap,
  themeKeywords,
  TMDB_THEME_IDS,
  TMDB_GENRE_IDS,
  TMDB_ID_TO_NAME,
  ECCHI_FILTER_RX,
  KIDS_FILTER_RX,
  MODERN_WAR_RX,
  SWORD_WAR_RX,
  GORE_FILTER_RX,
  getSimilarityScore,
  normalizeInput,
  getFranchiseKey,
  cleanAnchorQuery,
  isValidAmbiguousWord,
  isValidCtrlWord,
  resolveFuzzyAnchorTitle,
  resolveFuzzyDirector,
  resolveFuzzyActor,
  extractActors,
  normalizePromptSpelling,
  correctTypos,
  detectContradictions,
  parseQuery,
  scoreAndRank,
  getUserPreviousTexts,
  getSessionSeenIds,
  mergeContext,
  mergeHistoryContext,
  generateResponseText,
  buildReplyMessage,
  formatRecCards,
  logEngineStats,
};

export class CindromeEngine {
  static normalizeInput(rawText) {
    return normalizeInput(rawText);
  }

  static extractActors(rawText, director = null) {
    return extractActors(rawText, director);
  }

  static detectContradictions(params) {
    return detectContradictions(params);
  }

  static parseQuery(text, type = "mixed", reviewsCount = 0) {
    return parseQuery(text, type, reviewsCount);
  }

  static scoreAndRank(
    candidates,
    intent,
    profileStats = {},
    anchors = null,
    reviewsCount = 0,
  ) {
    return scoreAndRank(
      candidates,
      intent,
      profileStats,
      anchors,
      reviewsCount,
    );
  }

  static generateResponseText(
    intent,
    count,
    isColdStart = false,
    anchors = null,
  ) {
    return generateResponseText(intent, count, isColdStart, anchors);
  }
}

export default CindromeEngine;
