# ASMPT Football

A public RSVP page for one upcoming football session, backed by Supabase. People choose a registered player from the roster or RSVP as a guest by typing a name. Each name has one place in the attendance list; submitting again with the same name updates that RSVP. Attendance and names are public.

## Set up Supabase

1. Create a project at [Supabase](https://supabase.com/).
2. In the Supabase SQL Editor, run the contents of [`schema.sql`](./schema.sql). This creates or upgrades the roster, RSVP storage, guest flags, attendance limit, team-lock setting, and database functions. Run it again after deploying app changes that introduce database functions or columns. Existing Maybe/Can't make it answers are migrated to the waitlist.
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
     sessionDate: "Saturday, 3:00 pm",
     adminUsername: "ASMPT",
     adminEmail: "your-admin@email.com"
   };
   ```

   `sessionDate` can be left empty. Set `adminEmail` to the same email as the Supabase admin account you created and allowlisted. The admin page displays a username field; `adminUsername` defaults to `ASMPT` and maps that username to the Supabase email. Enter the account's password at sign-in; it is checked by Supabase and is never stored in the site files. The publishable/anon key is intended for public browser use; never put a service-role key or admin password in this file. Public users can read the roster and attendance and submit an RSVP. Only the allowlisted, signed-in admin can add or remove roster players; this is enforced in the database.

## Admin page

Open `admin.html` (or select **Admin** on the RSVP page), enter username `ASMPT`, and enter the password for the Supabase admin account. Set a maximum player limit; leave it blank for no limit. When teams are unlocked, ASMPT employees have priority over guests; within each group, the earliest RSVP keeps its place. Use **Lock in the teams** to preserve current places; while locked, new RSVPs fill any open places and go to "Unable to Attend / Waitlist" when capacity is full, regardless of employee or guest status. Unlocking recalculates attendance with employee priority. Changing the limit automatically recalculates the list when unlocked and warns if lowering it may move players to the waitlist. While locked, a limit cannot be lowered below the number currently attending. Add players, mark roster entries as guests, edit names or guest status, remove players, or reset all RSVPs to start a fresh attendance list. Resetting permanently removes every answer but does not change the player roster or limit, requires confirmation, and reports how many RSVPs were deleted. Renaming a player also updates their linked RSVP; a rename is rejected if the new name already has a different RSVP. Removing someone from the roster does not delete their existing RSVP. Roster entries marked as guests remain selectable and are labeled "Guest"; guests can also type a name using the separate guest RSVP option.

The public page has separate "Attending" and "Unable to Attend / Waitlist" sections. Each RSVP displays when the name was first added (in the visitor's local time). Every RSVP has a delete button; anyone with access to the page can delete an answer after confirming in the warning dialog. When teams are unlocked, removing an RSVP promotes the next eligible person according to the player-limit priority. When teams are locked, removing an attendee promotes the earliest waitlisted RSVP into the open place, without changing other locked places. An RSVP that is added directly to the waitlist displays a notice popup.

## Publish with GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In the repository, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
3. Once the **Deploy static site** workflow completes, use the Pages URL shown in the workflow or repository settings to share the app.

The workflow deploys the static files on pushes to `main`. Update `config.js` and push again when the session details change. Both the RSVP and admin pages are hosted at the same site; share the main `index.html` page with players.

## Local preview

After configuring Supabase, open `index.html` in a browser or serve this folder with any static file server. Some browsers restrict requests from pages opened directly as files; a local static server avoids that issue.
