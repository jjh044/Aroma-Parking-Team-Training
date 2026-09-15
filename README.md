# Aroma Parking App

A clean training app for new Aroma Church parking team volunteers. Volunteers create an account, sign in, choose a parking team category, and watch the training videos for that area.

## Project Folder

This project is saved locally at:

```text
C:\Users\jjhbi\Documents\ChatGPT\PARKING LOT APP
```

## Run Locally

```bash
npm start
```

On Windows, you can also double-click:

```text
run-local.cmd
```

Then open:

```text
http://127.0.0.1:3000
```

To use a different port:

```bash
PORT=4000 npm start
```

## Add Training Videos

Edit `data/training-content.json`.

Each category has a `videos` list. Replace the empty `url` fields with YouTube, Vimeo, or direct video links. YouTube links will automatically embed in the app.

```json
{
  "title": "Safety orientation",
  "description": "Core expectations before serving.",
  "duration": "5 min",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

## Backend

The app includes a small Node backend:

- `POST /api/signup`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/session`
- `GET /api/categories`

Passwords are hashed with PBKDF2 before being saved. Local user accounts are stored in `data/users.json`, which is ignored by Git.

## Deploy to Vercel

This project also includes Vercel serverless API routes in `api/`, so it can be imported from GitHub and deployed on Vercel.

Set this optional environment variable in Vercel:

```text
SESSION_SECRET=use-a-long-random-secret
```

The Vercel deployment uses signed session cookies instead of local file-based user storage. This keeps the training app usable on serverless hosting, but it is not a full production account database. For permanent volunteer accounts, connect a real database or auth provider later.
