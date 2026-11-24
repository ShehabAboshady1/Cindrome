import bcrypt from "bcrypt";
import db from "../config/db.js";

export const renderSignIn = (req, res) => res.render("sign-in.ejs");
export const renderSignUp = (req, res) => res.render("sign-up.ejs");

export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await db.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username],
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      let msg = "Account already exists";
      if (row.email === email) msg = "Email already registered";
      else if (row.username === username) msg = "Username already taken";

      return res.render("sign-up.ejs", { errorMessage: msg });
    }

    const hash = await bcrypt.hash(password, 10);

    const inserted = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [username, email, hash],
    );
    const uid = inserted.rows[0].id;

    await db.query(
      "INSERT INTO user_settings (user_id, is_private) VALUES ($1, $2)",
      [uid, false],
    );
    await db.query(
      "INSERT INTO user_profiles (user_id, avatar_url, backdrop_url) VALUES ($1, $2, $3)",
      [
        uid,
        "/assets/avatars/default-avatar.jpeg",
        "/assets/backdrops/default-backdrop.png",
      ],
    );

    const user = { id: uid, username, email };
    req.login(user, (err) => {
      if (err) {
        return res.render("sign-up.ejs", {
          errorMessage: "Registered, but auto-login failed.",
        });
      }
      return res.redirect("/");
    });
  } catch (err) {
    console.error(err);
    return res.render("sign-up.ejs", {
      errorMessage: "Server error. Please try again.",
    });
  }
};

export const logoutUser = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/");
  });
};

export const editProfile = async (req, res) => {
  const uid = req.user.id;
  const { displayName, username, bio, genre1, genre2 } = req.body;
  const files = req.files;

  try {
    await db.query("UPDATE users SET username = $1 WHERE id = $2", [
      username,
      uid,
    ]);
    await db.query(
      "UPDATE user_profiles SET display_name = $1, bio = $2 WHERE user_id = $3",
      [displayName, bio, uid],
    );

    let avatarUrl = req.user.avatar_url;

    if (files?.avatar) {
      const avatarPath = `/assets/avatars/${files.avatar[0].filename}`;
      await db.query(
        "UPDATE user_profiles SET avatar_url = $1 WHERE user_id = $2",
        [avatarPath, uid],
      );
      avatarUrl = avatarPath;
    }

    if (files?.backdrop) {
      const backdropPath = `/assets/backdrops/${files.backdrop[0].filename}`;
      await db.query(
        "UPDATE user_profiles SET backdrop_url = $1 WHERE user_id = $2",
        [backdropPath, uid],
      );
    }

    await db.query("DELETE FROM user_favorite_genres WHERE user_id = $1", [
      uid,
    ]);
    if (genre1) {
      await db.query(
        "INSERT INTO user_favorite_genres (user_id, genre) VALUES ($1, $2)",
        [uid, genre1],
      );
    }
    if (genre2 && genre2 !== genre1) {
      await db.query(
        "INSERT INTO user_favorite_genres (user_id, genre) VALUES ($1, $2)",
        [uid, genre2],
      );
    }

    const updated = { ...req.user, username, avatar_url: avatarUrl };

    req.login(updated, (err) => {
      if (err) return res.status(500).json({ error: "Session refresh failed" });
      return res.status(200).json({
        message: "Profile updated",
        newUsername: username,
      });
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already taken" });
    }
    res.status(500).json({ error: "Server error" });
  }
};
