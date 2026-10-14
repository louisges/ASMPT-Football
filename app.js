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
  const refreshButton = document.getElementById("refresh-button");
  let playersAvailable = false;

  document.getElementById("session-name").textContent = config.sessionName || "Football";
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

    try {
      const url = config.supabaseUrl.replace(/\/+$/, "") +
        "/rest/v1/rsvps?select=name,status,response_type&order=updated_at.desc";
      const response = await fetch(url, { headers: headers() });
      if (!response.ok) {
        throw new Error("Could not load attendance (HTTP " + response.status + ").");
      }

      const rsvps = await response.json();
      const counts = { yes: 0, maybe: 0, no: 0 };
      rsvps.forEach(function (rsvp) {
        if (Object.prototype.hasOwnProperty.call(counts, rsvp.status)) {
          counts[rsvp.status] += 1;
        }
      });
      document.getElementById("yes-count").textContent = String(counts.yes);
      document.getElementById("maybe-count").textContent = String(counts.maybe);
      document.getElementById("no-count").textContent = String(counts.no);

      rsvps.forEach(function (rsvp) {
        const item = document.createElement("li");
        item.className = "attendee";

        const name = document.createElement("span");
        name.className = "attendee-name";
        name.textContent = rsvp.name;

        const status = document.createElement("span");
        status.className = "attendee-status " + rsvp.status;
        status.textContent = (rsvp.response_type === "guest" ? "Guest · " : "") + ({
          yes: "I'm in",
          maybe: "Maybe",
          no: "Can't make it"
        }[rsvp.status] || "No answer");

        item.append(name, status);
        attendanceList.append(item);
      });

      setMessage(listMessage, rsvps.length ? "" : "No answers yet. Be the first to RSVP!", false);
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

    const nameType = selectedNameType();
    const name = nameType === "guest" ? guestName.value.trim() : playerName.value;
    const status = new FormData(form).get("status");
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
          body: JSON.stringify({ rsvp_name: name, rsvp_status: status, rsvp_type: nameType })
        }
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error("Could not save your answer (HTTP " + response.status + "). " + detail);
      }

      setMessage(formMessage, "Thanks — your answer has been saved.", false);
      await loadAttendance();
    } catch (error) {
      setMessage(formMessage, error.message || "Could not save your answer. Please try again.", true);
    } finally {
      submitButton.disabled = false;
    }
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
