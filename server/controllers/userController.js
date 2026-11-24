import db from "../config/db.js";
import axios from "axios";
import bcrypt from "bcrypt";

export const renderWatchlist = async (req, res) => {
  try {
    const sql = `
      SELECT w.status, m.tmdb_id, m.media_type, m.title, m.poster_path, m.run_time, 
             m.total_episodes, m.total_seasons, m.rating, m.is_anime,
             CASE WHEN l.id IS NOT NULL THEN true ELSE false END AS is_liked
      FROM watchlist w
      JOIN media_cache m ON w.tmdb_id = m.tmdb_id AND w.media_type = m.media_type
      LEFT JOIN liked_media l ON w.user_id = l.user_id AND w.tmdb_id = l.tmdb_id AND w.media_type = l.media_type
      WHERE w.user_id = $1 ORDER BY w.added_at DESC;
    `;
    const wlRes = await db.query(sql, [req.user.id]);
    res.render("watchlist.ejs", { watchlistItems: wlRes.rows });
  } catch (err) {
    console.error("Watchlist error:", err);
    res.render("watchlist.ejs", { watchlistItems: [] });
  }
};

export const toggleWatchlist = async (req, res) => {
  const { tmdb_id, media_type } = req.body;
  if (!tmdb_id || !media_type)
    return res.status(400).json({ error: "Missing data" });

  try {
    const existing = await db.query(
      "SELECT id FROM watchlist WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3",
      [req.user.id, tmdb_id, media_type],
    );

    if (existing.rows.length > 0) {
      await db.query("DELETE FROM watchlist WHERE id = $1", [
        existing.rows[0].id,
      ]);
      return res.status(200).json({ status: "removed" });
    }

    let title = "Unknown Title",
      poster = null,
      runtime = null,
      episodes = null,
      seasons = null,
      rating = null,
      isAnime = false;
    try {
      const epType = media_type === "anime" ? "tv" : media_type;
      const tmdbRes = await axios.get(
        `https://api.themoviedb.org/3/${epType}/${tmdb_id}?api_key=${process.env.TMDB_API_KEY}`,
      );
      const d = tmdbRes.data;
      title = d.title || d.name;
      poster = d.poster_path;
      rating = d.vote_average ? d.vote_average.toFixed(1) : null;
      if (d.original_language === "ja" && d.genres?.some((g) => g.id === 16)) {
        isAnime = true;
      }
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
      `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, run_time, total_episodes, total_seasons, rating, is_anime) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (tmdb_id, media_type) DO UPDATE SET rating = EXCLUDED.rating, is_anime = EXCLUDED.is_anime WHERE media_cache.rating IS NULL`,
      [
        tmdb_id,
        media_type,
        title,
        poster,
        runtime,
        episodes,
        seasons,
        rating,
        isAnime,
      ],
    );
    await db.query(
      `INSERT INTO watchlist (user_id, tmdb_id, media_type, status) VALUES ($1, $2, $3, 'plan_to_watch')`,
      [req.user.id, tmdb_id, media_type],
    );
    return res.status(200).json({ status: "added" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const toggleLike = async (req, res) => {
  const { tmdb_id, media_type } = req.body;
  if (!tmdb_id || !media_type)
    return res.status(400).json({ error: "Missing data" });

  try {
    const existing = await db.query(
      "SELECT id FROM liked_media WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3",
      [req.user.id, tmdb_id, media_type],
    );
    if (existing.rows.length > 0) {
      await db.query("DELETE FROM liked_media WHERE id = $1", [
        existing.rows[0].id,
      ]);
      return res.status(200).json({ status: "removed" });
    }

    let title = "Unknown Title",
      poster = null,
      runtime = null,
      episodes = null,
      seasons = null,
      rating = null,
      isAnime = false;
    try {
      const epType = media_type === "anime" ? "tv" : media_type;
      const tmdbRes = await axios.get(
        `https://api.themoviedb.org/3/${epType}/${tmdb_id}?api_key=${process.env.TMDB_API_KEY}`,
      );
      const d = tmdbRes.data;
      title = d.title || d.name;
      poster = d.poster_path;
      rating = d.vote_average ? d.vote_average.toFixed(1) : null;
      if (d.original_language === "ja" && d.genres?.some((g) => g.id === 16)) {
        isAnime = true;
      }
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
      `INSERT INTO media_cache (tmdb_id, media_type, title, poster_path, run_time, total_episodes, total_seasons, rating, is_anime) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (tmdb_id, media_type) DO UPDATE SET rating = EXCLUDED.rating, is_anime = EXCLUDED.is_anime WHERE media_cache.rating IS NULL`,
      [
        tmdb_id,
        media_type,
        title,
        poster,
        runtime,
        episodes,
        seasons,
        rating,
        isAnime,
      ],
    );
    await db.query(
      `INSERT INTO liked_media (user_id, tmdb_id, media_type) VALUES ($1, $2, $3)`,
      [req.user.id, tmdb_id, media_type],
    );
    return res.status(200).json({ status: "added" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const toggleFollow = async (req, res) => {
  const uid = req.user.id;
  const { followingId } = req.body;
  if (!followingId || uid === parseInt(followingId, 10))
    return res.status(400).json({ error: "Invalid operation" });
  try {
    const existing = await db.query(
      "SELECT * FROM followers WHERE follower_id = $1 AND following_id = $2",
      [uid, followingId],
    );
    if (existing.rows.length > 0) {
      await db.query(
        "DELETE FROM followers WHERE follower_id = $1 AND following_id = $2",
        [uid, followingId],
      );
      return res.status(200).json({ status: "unfollowed" });
    }
    await db.query(
      "INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)",
      [uid, followingId],
    );
    return res.status(200).json({ status: "followed" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const renderSettings = async (req, res) => {
  try {
    const sql = `
      SELECT u.email, s.is_private, s.notify_new_follower, s.notify_review_interaction
      FROM users u
      LEFT JOIN user_settings s ON u.id = s.user_id
      WHERE u.id = $1
    `;
    const resData = await db.query(sql, [req.user.id]);
    if (resData.rows.length === 0) return res.redirect("/");

    res.render("settings.ejs", { userSettings: resData.rows[0] });
  } catch (err) {
    res.redirect("/");
  }
};

export const updateSettings = async (req, res) => {
  const { is_private, notify_new_follower, notify_review_interaction } =
    req.body;
  try {
    await db.query(
      `UPDATE user_settings 
       SET is_private = $1, notify_new_follower = $2, notify_review_interaction = $3 
       WHERE user_id = $4`,
      [is_private, notify_new_follower, notify_review_interaction, req.user.id],
    );
    res.status(200).json({ message: "Settings updated" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
};

export const updateAccountSecurity = async (req, res) => {
  const { newEmail, currentPassword, newPassword } = req.body;
  try {
    if (currentPassword && newPassword) {
      const userRes = await db.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [req.user.id],
      );
      const valid = await bcrypt.compare(
        currentPassword,
        userRes.rows[0].password_hash,
      );
      if (!valid)
        return res.status(400).json({ error: "Incorrect current password" });

      const hash = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        hash,
        req.user.id,
      ]);
    }

    if (newEmail && newEmail !== req.user.email) {
      const emailCheck = await db.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [newEmail, req.user.id],
      );
      if (emailCheck.rows.length > 0)
        return res.status(400).json({ error: "Email already in use" });

      await db.query("UPDATE users SET email = $1 WHERE id = $2", [
        newEmail,
        req.user.id,
      ]);
    }

    res.status(200).json({ message: "Security updated" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    await db.query("BEGIN");
    await db.query("DELETE FROM user_settings WHERE user_id = $1", [
      req.user.id,
    ]);
    await db.query("DELETE FROM user_profiles WHERE user_id = $1", [
      req.user.id,
    ]);
    await db.query("DELETE FROM users WHERE id = $1", [req.user.id]);
    await db.query("COMMIT");

    req.logout((err) => {
      if (err) throw err;
      res.status(200).json({ message: "Account deleted" });
    });
  } catch (err) {
    await db.query("ROLLBACK");
    res.status(500).json({ error: "Failed to delete account" });
  }
};

export const renderProfile = async (req, res, next) => {
  try {
    const uname = req.params.username;
    const sql = `
      SELECT u.id, u.username, u.email, s.is_private, s.notify_new_follower, s.notify_review_interaction,
             p.display_name, p.bio, p.avatar_url, p.backdrop_url
      FROM users u LEFT JOIN user_settings s ON u.id = s.user_id LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.username = $1
    `;
    const userRes = await db.query(sql, [uname]);
    if (userRes.rows.length === 0)
      return res.status(404).send("User not found");
    const profileUser = userRes.rows[0];

    const genresRes = await db.query(
      "SELECT genre FROM user_favorite_genres WHERE user_id = $1 LIMIT 2",
      [profileUser.id],
    );
    const favoriteGenres = genresRes.rows.map((row) => row.genre);

    let isSelf = false,
      isFollowing = false;
    if (req.user) {
      if (req.user.id === profileUser.id) isSelf = true;
      else {
        const followRes = await db.query(
          "SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = $2",
          [req.user.id, profileUser.id],
        );
        if (followRes.rows.length > 0) isFollowing = true;
      }
    }

    const followersCount = (
      await db.query("SELECT COUNT(*) FROM followers WHERE following_id = $1", [
        profileUser.id,
      ])
    ).rows[0].count;
    const followingCount = (
      await db.query("SELECT COUNT(*) FROM followers WHERE follower_id = $1", [
        profileUser.id,
      ])
    ).rows[0].count;

    const favoriteMedia = (
      await db.query(
        `SELECT f.tmdb_id, f.media_type, m.title, m.poster_path, m.run_time, m.total_episodes, m.total_seasons FROM liked_media f JOIN media_cache m ON f.tmdb_id = m.tmdb_id AND f.media_type = m.media_type WHERE f.user_id = $1 ORDER BY f.liked_at DESC`,
        [profileUser.id],
      )
    ).rows;

    let myWatchlist = [];
    if (req.user) {
      myWatchlist = (
        await db.query(
          "SELECT tmdb_id, media_type FROM watchlist WHERE user_id = $1",
          [req.user.id],
        )
      ).rows;
    }

    const statsSql = `
      SELECT r.tmdb_id, r.media_type, r.season_number, r.episode_number, m.run_time, m.total_episodes, m.total_seasons,
      EXISTS (SELECT 1 FROM reviews r2 WHERE r2.user_id = $1 AND r2.tmdb_id = r.tmdb_id AND r2.media_type = r.media_type AND r2.season_number IS NULL) as watched_all
      FROM (SELECT DISTINCT ON (tmdb_id, media_type) * FROM reviews WHERE user_id = $1 ORDER BY tmdb_id, media_type, watch_date DESC, created_at DESC) r
      JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type
    `;
    const statsRes = await db.query(statsSql, [profileUser.id]);

    let statsMovies = 0,
      statsSeries = 0,
      statsAnime = 0,
      watchMins = 0,
      watchedCount = 0;
    statsRes.rows.forEach((row) => {
      const runtime =
        parseInt(row.run_time, 10) || (row.media_type === "anime" ? 24 : 45);
      if (row.media_type === "movie" || row.watched_all) {
        watchedCount++;
        if (row.media_type === "movie") statsMovies++;
        else if (row.media_type === "anime") statsAnime++;
        else statsSeries++;
      }
      if (row.media_type === "movie") watchMins += runtime;
      else {
        const totalEps = parseInt(row.total_episodes, 10) || 1;
        if (row.watched_all) watchMins += totalEps * runtime;
        else {
          const seasons = parseInt(row.total_seasons, 10) || 1;
          const avgEps = totalEps / seasons;
          let estEps =
            (parseInt(row.season_number, 10) || 1 - 1) * avgEps +
            (parseInt(row.episode_number, 10) || 0);
          if (
            estEps > totalEps ||
            (parseInt(row.episode_number, 10) || 0) > avgEps
          ) {
            estEps = Math.min(parseInt(row.episode_number, 10) || 0, totalEps);
          }
          watchMins += Math.round(estEps) * runtime;
        }
      }
    });
    const totalWatchHours = Math.round(watchMins / 60);

    const currentlyWatching = (
      await db.query(
        `SELECT DISTINCT ON (r.tmdb_id) r.tmdb_id, r.media_type, r.season_number, r.episode_number, r.watch_date, m.title, m.poster_path, m.total_episodes, m.total_seasons, m.is_anime FROM reviews r JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type WHERE r.user_id = $1 AND r.media_type != 'movie' AND r.season_number IS NOT NULL AND r.episode_number IS NOT NULL ORDER BY r.tmdb_id, r.watch_date DESC, r.created_at DESC`,
        [profileUser.id],
      )
    ).rows
      .map((item) => {
        const totalEps = parseInt(item.total_episodes, 10) || 0,
          seasons = parseInt(item.total_seasons, 10) || 1,
          curSeason = parseInt(item.season_number, 10) || 1,
          curEp = parseInt(item.episode_number, 10) || 0;
        let progressPercentage = 0,
          progressText = `Season ${curSeason} • Episode ${curEp}`;
        if (totalEps > 0) {
          const avgEps = totalEps / seasons;
          let estEps = (curSeason - 1) * avgEps + curEp;
          if (estEps > totalEps || curEp > avgEps) {
            estEps = Math.min(curEp, totalEps);
          }
          estEps = Math.round(estEps);
          progressPercentage = Math.min(
            100,
            Math.round((estEps / totalEps) * 100),
          );
          if (item.is_anime) progressText = `Episode ${estEps} of ${totalEps}`;
        }
        return { ...item, progressPercentage, progressText };
      })
      .sort((a, b) => new Date(b.watch_date) - new Date(a.watch_date));

    const userReviews = (
      await db.query(
        `SELECT r.id AS review_id, r.tmdb_id, r.media_type, r.rating, r.review_text, r.has_spoilers, r.liked, r.created_at, r.season_number, r.episode_number, m.is_anime, m.title, m.poster_path, (SELECT COUNT(*) FROM review_likes rl WHERE rl.review_id = r.id) as likes_count, (SELECT COUNT(*) FROM review_comments rc WHERE rc.review_id = r.id) as comments_count, ${req.user ? `EXISTS (SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = ${req.user.id})` : "false"} as is_liked_by_user FROM reviews r JOIN media_cache m ON r.tmdb_id = m.tmdb_id AND r.media_type = m.media_type WHERE r.user_id = $1 AND r.review_text IS NOT NULL AND TRIM(r.review_text) != '' ORDER BY r.created_at DESC`,
        [profileUser.id],
      )
    ).rows;

    const userLists = (
      await db.query(
        `SELECT l.id AS list_id, l.title, l.is_private, l.created_at, COUNT(DISTINCT li.id) AS total_items, (SELECT COUNT(*) FROM list_likes ll WHERE ll.list_id = l.id) as likes_count, (SELECT COUNT(*) FROM list_comments lc WHERE lc.list_id = l.id) as comments_count, ${req.user ? `EXISTS (SELECT 1 FROM list_likes ll WHERE ll.list_id = l.id AND ll.user_id = ${req.user.id})` : "false"} as is_liked_by_user, COALESCE((SELECT json_agg(sub.poster_path) FROM (SELECT mc.poster_path FROM list_items li2 LEFT JOIN media_cache mc ON li2.tmdb_id = mc.tmdb_id AND li2.media_type = mc.media_type WHERE li2.list_id = l.id ORDER BY li2.order_index ASC LIMIT 4) sub), '[]'::json) AS preview_posters FROM lists l LEFT JOIN list_items li ON l.id = li.list_id WHERE l.user_id = $1 AND (l.is_private = false OR $2 = true) GROUP BY l.id ORDER BY l.created_at DESC`,
        [profileUser.id, isSelf],
      )
    ).rows;

    res.render("profile.ejs", {
      currentlyWatching,
      profileUser,
      favoriteGenres,
      isSelf,
      isFollowing,
      followersCount,
      followingCount,
      totalWatchedCount: watchedCount,
      favoriteMedia,
      myWatchlist,
      statsMovies,
      statsSeries,
      statsAnime,
      totalWatchHours,
      userReviews,
      userLists,
    });
  } catch (err) {
    next(err);
  }
};
