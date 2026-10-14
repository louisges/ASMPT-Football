# Football plans

A small, public RSVP page for one upcoming football session. Answers are stored in Supabase and are visible to anyone who can access the site. Each name has one answer; submitting again with the same name updates it (names are matched without regard to capitalization). There is no sign-in, so users can submit or change an answer under any name.

## Set up the shared RSVP list

1. Create a project at [Supabase](https://supabase.com/).
2. In the Supabase SQL Editor, run the contents of [`schema.sql`](./schema.sql).
3. In the project settings, find the Project URL and the publishable/anon key.
4. Put those values in [`config.js`](./config.js):

   ```js
   window.FOOTBALL_CONFIG = {
     supabaseUrl: "https://your-project.supabase.co",
     supabaseAnonKey: "your-public-anon-key",
     sessionName: "Football",
     sessionDate: "Saturday, 3:00 pm"
   };
   ```

   `sessionDate` can be left empty. The Supabase publishable/anon key is intended for public browser use; do not put a service-role key in this file. The database grants public read access and RSVP submission only through the validation function.

## Publish with GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In the repository, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
3. Once the **Deploy static site** workflow completes, use the Pages URL shown in the workflow or repository settings to share the app.

The workflow deploys the static files on pushes to `main`. Update `config.js` and push again when the session details change.

## Local preview

After configuring Supabase, open `index.html` in a browser or serve this folder with any static file server. Some browsers restrict requests from pages opened directly as files; a local static server avoids that issue.
