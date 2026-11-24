import db from "../config/db.js";
import axios from "axios";
import { formatCommentText } from "../utils/helpers.js";

export const renderDiary = async (req, res) => {
  try {
    const sql = `
      SELECT r.id AS review_id, r.tmdb_id, r.media_type, r.rating, r.review_text, r.is_rewatch, r.has_spoilers, r.liked, r.watch_date, r.season_number, r.episode_number,
      m.title, m.poster_path, m.is_anime, m.run_time, m.total_episodes, m.total_seasons,
      EXTRACT(YEAR FROM r.watch_date) AS watch_year, TO_CHAR(r.watch_date, 'Month') AS watch_month, EXTRACT(DAY FROM r.watch_date) AS watch_day
      FROM reviews r JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
      WHERE r.user_id = $1 ORDER BY r.watch_date DESC, r.created_at DESC
    `;
    const logsRes = await db.query(sql, [req.user.id]);
    const logs = logsRes.rows;
    const currentYear = new Date().getFullYear();
    const currentYearCount = logs.filter(
      (log) => parseInt(log.watch_year, 10) === currentYear,
    ).length;
    const groupedLogs = {};
    logs.forEach((log) => {
      const key = `${log.watch_month.trim()}${log.watch_year}`;
      if (!groupedLogs[key]) groupedLogs[key] = [];
      groupedLogs[key].push(log);
    });
    res.render("diary.ejs", { groupedLogs, currentYearCount, currentYear });
  } catch (err) {
    res.render("diary.ejs", {
      groupedLogs: {},
      currentYearCount: 0,
      currentYear: new Date().getFullYear(),
    });
  }
};

export const renderSingleReview = async (req, res) => {
  try {
    const id = req.params.id;
    const sql = `
      SELECT r.id AS review_id, r.rating, r.review_text, r.watch_date, r.has_spoilers, r.liked, r.season_number, r.episode_number,
      u.username, p.display_name, p.avatar_url, m.tmdb_id, m.media_type, m.title, m.poster_path, m.is_anime, EXTRACT(YEAR FROM r.watch_date) AS watch_year
      FROM reviews r JOIN users u ON r.user_id = u.id LEFT JOIN user_profiles p ON u.id = p.user_id JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
      WHERE r.id = $1
    `;
    const revRes = await db.query(sql, [id]);
    if (revRes.rows.length === 0)
      return res.status(404).send("Review not found");
    const review = revRes.rows[0];

    try {
      const url = `https://api.themoviedb.org/3/${review.media_type === "anime" ? "tv" : review.media_type}/${review.tmdb_id}?api_key=${process.env.TMDB_API_KEY}`;
      const tmdbRes = await axios.get(url);
      review.backdrop_path = tmdbRes.data.backdrop_path;
    } catch (err) {}

    const likesRes = await db.query(
      "SELECT COUNT(*) FROM review_likes WHERE review_id = $1",
      [id],
    );
    const likesCount = parseInt(likesRes.rows[0].count, 10) || 0;
    const countRes = await db.query(
      "SELECT COUNT(*) FROM review_comments WHERE review_id = $1",
      [id],
    );
    const commentsCount = parseInt(countRes.rows[0].count, 10) || 0;

    let isLikedByCurrentUser = false;
    if (req.user) {
      const likedRes = await db.query(
        "SELECT 1 FROM review_likes WHERE review_id = $1 AND user_id = $2",
        [id, req.user.id],
      );
      if (likedRes.rows.length > 0) isLikedByCurrentUser = true;
    }

    const commentsSql = `
      SELECT c.id, c.content, c.created_at, c.parent_comment_id, u.username, p.avatar_url,
      (SELECT COUNT(*) FROM review_comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
      ${req.user ? `EXISTS (SELECT 1 FROM review_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ${req.user.id})` : "false"} as is_liked_by_user
      FROM review_comments c JOIN users u ON c.user_id = u.id LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE c.review_id = $1 ORDER BY c.created_at ASC
    `;
    const commentsRes = await db.query(commentsSql, [id]);
    const comments = commentsRes.rows.map((c) => ({
      ...c,
      content: formatCommentText(c.content),
      replies: [],
    }));
    const mainComments = [];
    const byId = {};
    comments.forEach((c) => (byId[c.id] = c));
    comments.forEach((c) =>
      c.parent_comment_id && byId[c.parent_comment_id]
        ? byId[c.parent_comment_id].replies.push(c)
        : mainComments.push(c),
    );

    res.render("single-review.ejs", {
      review,
      likesCount,
      commentsCount,
      isLikedByCurrentUser,
      mainComments,
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
};

export const logReview = async (req, res) => {
  const {
    tmdb_id,
    media_type,
    rating,
    review_text,
    is_rewatch,
    has_spoilers,
    liked,
    season_number,
    episode_number,
    watch_date,
  } = req.body;
  if (!tmdb_id || !media_type)
    return res.status(400).json({ error: "Missing required data" });

  try {
    let title = "Unknown Title",
      poster = null,
      runtime = null,
      episodes = null,
      seasons = null;
    try {
      const tmdbRes = await axios.get(
        `https://api.themoviedb.org/3/${media_type === "anime" ? "tv" : media_type}/${tmdb_id}?api_key=${process.env.TMDB_API_KEY}`,
      );
      const d = tmdbRes.data;
      title = d.title || d.name;
      poster = d.poster_path;
      if (media_type === "movie") runtime = d.runtime;
      else {
        episodes = d.number_of_episodes;
        seasons = d.number_of_seasons;
        if (d.episode_run_time?.length > 0) runtime = d.episode_run_time[0];
        else if (d.last_episode_to_air?.runtime)
          runtime = d.last_episode_to_air.runtime;
      }
    } catch (err) {}

    await db.query(
      `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, run_time, total_episodes, total_seasons) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (tmdb_id, media_type) DO UPDATE SET run_time = EXCLUDED.run_time WHERE media_cache.run_time IS NULL`,
      [tmdb_id, media_type, title, poster, runtime, episodes, seasons],
    );

    const inserted = await db.query(
      `INSERT INTO reviews (user_id, tmdb_id, media_type, rating, review_text, is_rewatch, has_spoilers, liked, season_number, episode_number, watch_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id;`,
      [
        req.user.id,
        tmdb_id,
        media_type,
        rating || null,
        review_text || null,
        is_rewatch || false,
        has_spoilers || false,
        liked || false,
        season_number || null,
        episode_number || null,
        watch_date || new Date().toISOString().split("T")[0],
      ],
    );

    if (liked) {
      await db.query(
        `INSERT INTO liked_media (user_id, tmdb_id, media_type) VALUES ($1, $2, $3) ON CONFLICT (user_id, tmdb_id, media_type) DO NOTHING`,
        [req.user.id, tmdb_id, media_type],
      );
    }

    res
      .status(200)
      .json({ message: "Log saved", review_id: inserted.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const updateReview = async (req, res) => {
  const {
    rating,
    review_text,
    is_rewatch,
    has_spoilers,
    liked,
    season_number,
    episode_number,
    watch_date,
  } = req.body;
  try {
    await db.query(
      `UPDATE reviews SET rating = $1, review_text = $2, is_rewatch = $3, has_spoilers = $4, liked = $5, season_number = $6, episode_number = $7, watch_date = $8 WHERE id = $9 AND user_id = $10`,
      [
        rating,
        review_text,
        is_rewatch,
        has_spoilers,
        liked,
        season_number,
        episode_number,
        watch_date,
        req.params.id,
        req.user.id,
      ],
    );
    res.status(200).json({ message: "Log updated" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteReview = async (req, res) => {
  try {
    await db.query("DELETE FROM reviews WHERE id = $1 AND user_id = $2", [
      req.params.id,
      req.user.id,
    ]);
    res.status(200).json({ message: "Log deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const toggleReviewLike = async (req, res) => {
  try {
    const existing = await db.query(
      "SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (existing.rows.length > 0) {
      await db.query("DELETE FROM review_likes WHERE id = $1", [
        existing.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      await db.query(
        "INSERT INTO review_likes (review_id, user_id) VALUES ($1, $2)",
        [req.params.id, req.user.id],
      );
      res.json({ status: "added" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const addReviewComment = async (req, res) => {
  const { content, parent_comment_id } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "Empty comment" });
  try {
    const inserted = await db.query(
      `INSERT INTO review_comments (review_id, user_id, content, parent_comment_id) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [req.params.id, req.user.id, content.trim(), parent_comment_id || null],
    );
    res.status(200).json({
      message: "Comment added",
      comment_id: inserted.rows[0].id,
      created_at: inserted.rows[0].created_at,
      username: req.user.username,
      avatar_url: req.user.avatar_url,
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const toggleCommentLike = async (req, res) => {
  try {
    const existing = await db.query(
      "SELECT id FROM review_comment_likes WHERE comment_id = $1 AND user_id = $2",
      [req.params.id, req.user.id],
    );
    if (existing.rows.length > 0) {
      await db.query("DELETE FROM review_comment_likes WHERE id = $1", [
        existing.rows[0].id,
      ]);
      res.json({ status: "removed" });
    } else {
      await db.query(
        "INSERT INTO review_comment_likes (comment_id, user_id) VALUES ($1, $2)",
        [req.params.id, req.user.id],
      );
      res.json({ status: "added" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};
