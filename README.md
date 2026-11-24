# Cindrome

Cindrome is a web application for tracking movies, TV series, and anime. Users can log what they watch, write reviews, create lists, follow other users, and get recommendations using **Drome**, our built-in recommendation assistant.

## Main Features

- **Browse & Search:** Explore trending and top-rated movies, series, and anime using the TMDB API, with filters for genre, rating, and release year.
- **Watch Diary:** Log watched movies or specific episodes with star ratings, watch dates, rewatch tags, and spoiler warnings.
- **Custom Lists:** Create public or private lists, reorder items with drag-and-drop, and track how much of a list you have watched.
- **User Profiles:** Customize your profile (avatar, banner, bio, favorite genres), follow other users, and view your total watch time.
- **Drome Assistant:** Ask for movie/show recommendations in plain English based on mood, genre, era, or similar titles.

## Built With

- **Backend:** Node.js, Express, EJS
- **Database:** PostgreSQL
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **External API:** TMDB API

## How to Run Locally

1. Clone the project and go to the server folder:

   ```bash
   git clone https://github.com/ShehabAboshady1/Cindrome.git
   cd cindrome/server
   ```

2. Install the required packages:

   ```bash
   npm install
   ```

3. Create a `.env` file inside the `server` folder and add your database and TMDB credentials:

   ```env
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=cindrome
   SESSION_SECRET=your_secret_key
   TMDB_API_KEY=your_tmdb_api_key
   ```

4. Start the server:
   ```bash
   npm start
   ```
   Then open `http://localhost:3000` in your browser.
