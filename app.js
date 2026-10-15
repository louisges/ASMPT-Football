(function () {
  "use strict";

  const config = window.FOOTBALL_CONFIG || {};
  const form = document.getElementById("rsvp-form");
  const playerName = document.getElementById("player-name");
  const guestName = document.getElementById("guest-name");
  const playerNameField = document.getElementById("player-name-field");
  const guestNameField = document.getElementById("guest-name-field");
  const submitButton = document.getElementById("submit-button");
  const formMessage = document.getElementById("form-message");
  const listMessage = document.getElementById("list-message");
  const attendanceList = document.getElementById("attendance-list");
  const unableList = document.getElementById("unable-list");
  const attendingEmpty = document.getElementById("attending-empty");
  const unableEmpty = document.getElementById("unable-empty");
  const capacityCount = document.getElementById("capacity-count");
  const attendanceStatusIndicator = document.getElementById("attendance-status-indicator");
  const refreshButton = document.getElementById("refresh-button");
  const deleteDialog = document.getElementById("delete-rsvp-dialog");
  const deleteWarning = document.getElementById("delete-rsvp-warning");
  const confirmDeleteButton = document.getElementById("confirm-delete-rsvp");
  const waitlistNoticeDialog = document.getElementById("waitlist-notice-dialog");
  const waitlistNoticeMessage = document.getElementById("waitlist-notice-message");
  const closedNoticeDialog = document.getElementById("closed-notice-dialog");
  let pendingDeleteName = null;
  let playersAvailable = false;
  let attendanceStatus = null;

  const sessionDate = document.getElementById("session-date");
  if (config.sessionDate) {
    sessionDate.textContent = config.sessionDate;
  }

  function isConfigured() {
    return config.supabaseUrl &&
      config.supabaseAnonKey &&
      !config.supabaseUrl.includes("YOUR-PROJECT") &&
      !config.supabaseAnonKey.includes("YOUR_SUPABASE");
  }

  function setMessage(element, text, isError) {
    element.textContent = text;
    element.classList.toggle("error", Boolean(isError));
  }

  function headers() {
    return {
      apikey: config.supabaseAnonKey,
      Authorization: "Bearer " + config.supabaseAnonKey,
      "Content-Type": "application/json"
    };
  }

  function selectedNameType() {
    return new FormData(form).get("name-type");
  }

  function updateNameFields() {
    const isGuest = selectedNameType() === "guest";
    playerNameField.hidden = isGuest;
    guestNameField.hidden = !isGuest;
    playerName.disabled = isGuest || !playersAvailable;
    playerName.required = !isGuest;
    guestName.disabled = !isGuest;
    guestName.required = isGuest;
  }

  async function loadPlayers() {
    if (!isConfigured()) {
      playerName.replaceChildren(new Option("Configure Supabase first", ""));
      playersAvailable = false;
      updateNameFields();
      return;
    }

    try {
      const url = config.supabaseUrl.replace(/\/+$/, "") +
        "/rest/v1/players?select=name,is_guest&order=name.asc";
      const response = await fetch(url, { headers: headers() });
      if (!response.ok) {
        throw new Error("Could not load the player list (HTTP " + response.status + ").");
      }
      const players = await response.json();
      playerName.replaceChildren(new Option("Select your name", ""));
      players.forEach(function (player) {
        playerName.add(new Option(player.name + (player.is_guest ? " (Guest)" : ""), player.name));
      });
      playersAvailable = players.length > 0;
      if (players.length === 0) {
        playerName.replaceChildren(new Option("No players added yet", ""));
      }
      updateNameFields();
    } catch (error) {
      playerName.replaceChildren(new Option("Could not load players", ""));
      playersAvailable = false;
      updateNameFields();
      setMessage(formMessage, error.message || "Could not load players.", true);
    }
  }

  async function loadAttendance() {
    if (!isConfigured()) {
      setMessage(listMessage, "Add your Supabase project details in config.js to enable shared responses.", true);
      return;
    }

    listMessage.classList.remove("error");
    setMessage(listMessage, "Loading attendance…", false);
    attendanceList.replaceChildren();
    unableList.replaceChildren();

    try {
      const baseUrl = config.supabaseUrl.replace(/\/+$/, "");
      const responses = await Promise.all([
        fetch(baseUrl + "/rest/v1/rsvps?select=name,status,response_type,created_at,id&order=created_at.asc,id.asc", {
          headers: headers()
        }),
        fetch(baseUrl + "/rest/v1/attendance_settings?select=max_players,attendance_status&id=eq.true", {
          headers: headers()
        })
      ]);
      if (!responses[0].ok) {
        throw new Error("Could not load attendance (HTTP " + responses[0].status + ").");
      }
      if (!responses[1].ok) {
        throw new Error("Could not load the player limit (HTTP " + responses[1].status + ").");
      }
      const rsvps = await responses[0].json();
      const settings = await responses[1].json();
      if (settings.length !== 1) {
        throw new Error("Player limit settings are missing. Run the latest schema.sql in Supabase.");
      }
      const maxPlayers = settings[0].max_players;
      attendanceStatus = settings[0].attendance_status;
      const attending = rsvps.filter(function (rsvp) { return rsvp.status === "yes"; });
      const unable = rsvps.filter(function (rsvp) { return rsvp.status === "unable"; });
      document.getElementById("yes-count").textContent = String(attending.length);
      document.getElementById("unable-count").textContent = String(unable.length);
      capacityCount.textContent = maxPlayers === null
        ? attending.length + " players coming · no player limit"
        : attending.length + " of " + maxPlayers + " places filled";
      const statusDetails = {
        open: ["OPEN — RSVPs are being accepted", "open"],
        closed: ["CLOSED — no new RSVPs are being accepted", "closed"],
        locked: ["LOCKED — team places are fixed", "locked"]
      };
      const statusDetail = statusDetails[attendanceStatus];
      if (!statusDetail) {
        throw new Error("Attendance status is invalid. Run the latest schema.sql in Supabase.");
      }
      attendanceStatusIndicator.textContent = statusDetail[0];
      attendanceStatusIndicator.className = "attendance-status-indicator " + statusDetail[1];

      rsvps.forEach(function (rsvp) {
        const item = document.createElement("li");
        item.className = "attendee";

        const details = document.createElement("div");
        details.className = "attendee-details";
        const name = document.createElement("span");
        name.className = "attendee-name";
        name.textContent = rsvp.name + (rsvp.response_type === "guest" ? " (Guest)" : "");

        const submittedAt = new Date(rsvp.created_at);
        const timestamp = document.createElement("time");
        timestamp.className = "attendee-timestamp";
        timestamp.dateTime = rsvp.created_at;
        timestamp.textContent = "Added " + new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short"
        }).format(submittedAt);
        details.append(name, timestamp);

        const actions = document.createElement("div");
        actions.className = "attendee-actions";
        item.append(details, actions);
        const deleteButton = document.createElement("button");
        deleteButton.className = "delete-rsvp-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute("aria-label", "Delete " + rsvp.name + "'s RSVP");
        deleteButton.addEventListener("click", function () {
          pendingDeleteName = rsvp.name;
          deleteWarning.textContent = "This will permanently remove " + rsvp.name +
            "'s answer from the attendance list.";
          deleteDialog.showModal();
        });
        actions.append(deleteButton);
        (rsvp.status === "unable" ? unableList : attendanceList).append(item);
      });

      attendingEmpty.hidden = attending.length > 0;
      unableEmpty.hidden = unable.length > 0;
      setMessage(listMessage, "", false);
    } catch (error) {
      setMessage(listMessage, error.message || "Could not load attendance. Please try again.", true);
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!isConfigured()) {
      setMessage(formMessage, "This page isn't connected yet. Add the Supabase details in config.js.", true);
      return;
    }

    if (attendanceStatus === "closed") {
      closedNoticeDialog.showModal();
      return;
    }

    const nameType = selectedNameType();
    const name = nameType === "guest" ? guestName.value.trim() : playerName.value;
    if (!name) {
      (nameType === "guest" ? guestName : playerName).focus();
      setMessage(formMessage, nameType === "guest" ? "Enter your name to RSVP." : "Select your name to RSVP.", true);
      return;
    }

    submitButton.disabled = true;
    setMessage(formMessage, "Sending your answer…", false);

    try {
      const response = await fetch(
        config.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/submit_rsvp",
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ rsvp_name: name, rsvp_type: nameType })
        }
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error("Could not save your answer (HTTP " + response.status + "). " + detail);
      }

      const result = await response.json();
      const addedToWaitlist = result === "unable";
      setMessage(formMessage, addedToWaitlist
        ? "This name has been added to Unable to Attend / Waitlist."
        : "Name added to Attending.", false);
      await loadAttendance();
      if (addedToWaitlist) {
        waitlistNoticeMessage.textContent = name + " has been added to Unable to Attend / Waitlist because all places are full.";
        waitlistNoticeDialog.showModal();
      }
    } catch (error) {
      if (error.message && error.message.includes("Attendance is closed.")) {
        closedNoticeDialog.showModal();
      } else {
        setMessage(formMessage, error.message || "Could not save your answer. Please try again.", true);
      }
    } finally {
      submitButton.disabled = false;
    }
  });

  document.getElementById("cancel-delete-rsvp").addEventListener("click", function () {
    pendingDeleteName = null;
    deleteDialog.close();
  });

  confirmDeleteButton.addEventListener("click", async function () {
    if (!pendingDeleteName) {
      return;
    }

    const name = pendingDeleteName;
    confirmDeleteButton.disabled = true;
    setMessage(listMessage, "Deleting " + name + "'s RSVP…", false);
    try {
      const response = await fetch(
        config.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/delete_rsvp",
        {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({ rsvp_name: name })
        }
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error("Could not delete the RSVP (HTTP " + response.status + "). " + detail);
      }

      pendingDeleteName = null;
      deleteDialog.close();
      await loadAttendance();
      setMessage(listMessage, name + "'s RSVP was deleted.", false);
    } catch (error) {
      setMessage(listMessage, error.message || "Could not delete the RSVP.", true);
    } finally {
      confirmDeleteButton.disabled = false;
    }
  });

  document.getElementById("close-waitlist-notice").addEventListener("click", function () {
    waitlistNoticeDialog.close();
  });

  document.getElementById("close-closed-notice").addEventListener("click", function () {
    closedNoticeDialog.close();
  });

  form.querySelectorAll('input[name="name-type"]').forEach(function (input) {
    input.addEventListener("change", updateNameFields);
  });
  refreshButton.addEventListener("click", loadAttendance);
  updateNameFields();
  loadPlayers();
  loadAttendance();
  window.setInterval(loadAttendance, 30000);
}());
