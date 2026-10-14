# Football plans

A public RSVP page for one upcoming football session, backed by Supabase. People choose a registered player from the roster or RSVP as a guest by typing a name. Each name has one answer; submitting again with the same name updates it (names are matched without regard to capitalization). Attendance and names are public.

## Set up Supabase

1. Create a project at [Supabase](https://supabase.com/).
2. In the Supabase SQL Editor, run the contents of [`schema.sql`](./schema.sql). This creates or upgrades the roster, RSVP storage, guest flags, and protected admin functions. Run it again after deploying these player-editing changes so Supabase adds the guest field and update function.
3. In **Authentication → Users**, create an account for yourself with your email and a password. Do not add a public sign-up form to the site.
4. In the SQL Editor, allowlist your account's email for roster administration. It must be the same email as `adminEmail` in `config.js` and the email on the Supabase account you use to sign in (the username `ASMPT` is only a sign-in label):

   ```sql
   insert into public.admin_users (email)
   values (lower(btrim('louisjamesgarden@gmail.com')))
   on conflict (email) do nothing;
   ```

5. In **Project Settings → API**, copy the Project URL and publishable/anon key into [`config.js`](./config.js):

   ```js
   window.FOOTBALL_CONFIG = {
     supabaseUrl: "https://your-project.supabase.co",
     supabaseAnonKey: "your-public-anon-key",
     sessionName: "Football",
     sessionDate: "Saturday, 3:00 pm",
     adminUsername: "ASMPT",
     adminEmail: "your-admin@email.com"
   };
   ```

   `sessionDate` can be left empty. Set `adminEmail` to the same email as the Supabase admin account you created and allowlisted. The admin page displays a username field; `adminUsername` defaults to `ASMPT` and maps that username to the Supabase email. Enter the account's password at sign-in; it is checked by Supabase and is never stored in the site files. The publishable/anon key is intended for public browser use; never put a service-role key or admin password in this file. Public users can read the roster and attendance and submit an RSVP. Only the allowlisted, signed-in admin can add or remove roster players; this is enforced in the database.

## Admin page

Open `admin.html` (or select **Admin** on the RSVP page), enter username `ASMPT`, and enter the password for the Supabase admin account. Add players, mark roster entries as guests, edit names or guest status, and remove players there. Renaming a player also updates their linked RSVP; a rename is rejected if the new name already has a different RSVP. Removing someone from the roster does not delete their existing RSVP. Roster entries marked as guests remain selectable and are labeled "Guest"; guests can also type a name using the separate guest RSVP option.

## Publish with GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In the repository, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
3. Once the **Deploy static site** workflow completes, use the Pages URL shown in the workflow or repository settings to share the app.

The workflow deploys the static files on pushes to `main`. Update `config.js` and push again when the session details change. Both the RSVP and admin pages are hosted at the same site; share the main `index.html` page with players.

## Local preview

After configuring Supabase, open `index.html` in a browser or serve this folder with any static file server. Some browsers restrict requests from pages opened directly as files; a local static server avoids that issue.
