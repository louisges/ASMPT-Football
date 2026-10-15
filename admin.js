(function () {
  "use strict";

  const config = window.FOOTBALL_CONFIG || {};
  const storageKey = "football-admin-session";
  const loginPanel = document.getElementById("login-panel");
  const managerPanel = document.getElementById("manager-panel");
  const loginForm = document.getElementById("login-form");
  const loginButton = document.getElementById("login-button");
  const loginMessage = document.getElementById("login-message");
  const managerMessage = document.getElementById("manager-message");
  const addPlayerForm = document.getElementById("add-player-form");
  const addPlayerButton = document.getElementById("add-player-button");
  const newPlayerInput = document.getElementById("new-player");
  const newPlayerGuest = document.getElementById("new-player-guest");
  const playerList = document.getElementById("player-list");
  const playerLimitForm = document.getElementById("player-limit-form");
  const playerLimitInput = document.getElementById("player-limit");
  const savePlayerLimitButton = document.getElementById("save-player-limit");
  const limitMessage = document.getElementById("limit-message");
  const attendanceStatusForm = document.getElementById("attendance-status-form");
  const attendanceStatusInput = document.getElementById("attendance-status");
  const saveAttendanceStatusButton = document.getElementById("save-attendance-status");
  const attendanceStatusMessage = document.getElementById("attendance-status-message");
  const attendanceStatusIndicator = document.getElementById("attendance-status-indicator");
  const copyAttendingButton = document.getElementById("copy-attending-list");
  const copyWaitlistButton = document.getElementById("copy-waitlist");
  const copyListMessage = document.getElementById("copy-list-message");
  const unlistedRsvpsList = document.getElementById("unlisted-rsvps-list");
  const unlistedRsvpsMessage = document.getElementById("unlisted-rsvps-message");
  const refreshUnlistedRsvpsButton = document.getElementById("refresh-unlisted-rsvps");
  const rosterTab = document.getElementById("roster-tab");
  const historyTab = document.getElementById("history-tab");
  const overviewTab = document.getElementById("overview-tab");
  const rosterTabPanel = document.getElementById("roster-tab-panel");
  const historyTabPanel = document.getElementById("history-tab-panel");
  const overviewTabPanel = document.getElementById("overview-tab-panel");
  const capturePlayersForm = document.getElementById("capture-players-form");
  const captureDateInput = document.getElementById("capture-date");
  const capturePlayersButton = document.getElementById("capture-players-button");
  const captureMessage = document.getElementById("capture-message");
  const attendanceHistoryList = document.getElementById("attendance-history-list");
  const attendanceHistoryMessage = document.getElementById("attendance-history-message");
  const refreshAttendanceHistoryButton = document.getElementById("refresh-attendance-history");
  const overviewYearInput = document.getElementById("overview-year");
  const attendanceOverviewBody = document.getElementById("attendance-overview-body");
  const attendanceOverviewMessage = document.getElementById("attendance-overview-message");
  const limitWarningDialog = document.getElementById("limit-warning-dialog");
  const limitWarningMessage = document.getElementById("limit-warning-message");
  const confirmLimitButton = document.getElementById("confirm-limit-change");
  const resetDialog = document.getElementById("reset-rsvps-dialog");
  const confirmResetButton = document.getElementById("confirm-reset-rsvps");
  const deleteCaptureDialog = document.getElementById("delete-capture-dialog");
  const deleteCaptureMessage = document.getElementById("delete-capture-message");
  const confirmDeleteCaptureButton = document.getElementById("confirm-delete-capture");
  let session = null;
  let currentPlayerLimit = null;
  let currentAttendanceStatus = "open";
  let pendingPlayerLimit = null;
  let pendingCaptureId = null;

  function isConfigured() {
    return config.supabaseUrl &&
      config.supabaseAnonKey &&
      !config.supabaseUrl.includes("YOUR-PROJECT") &&
      !config.supabaseAnonKey.includes("YOUR_SUPABASE");
  }

  async function loadUnlistedRsvps() {
    refreshUnlistedRsvpsButton.disabled = true;
    setMessage(unlistedRsvpsMessage, "Loading names not on the player list…", false);
    unlistedRsvpsList.replaceChildren();
    try {
      const rsvps = await request(
        "/rest/v1/rsvps?select=name,status,response_type,is_employee,player_id&player_id=is.null&order=created_at.asc,id.asc"
      );
      if (!Array.isArray(rsvps)) {
        throw new Error("Supabase returned an invalid RSVP list.");
      }
      if (rsvps.length === 0) {
        setMessage(unlistedRsvpsMessage, "There are no names to add right now.", false);
        return;
      }

      rsvps.forEach(function (rsvp) {
        const item = document.createElement("li");
        item.className = "attendee";
        const details = document.createElement("div");
        details.className = "attendee-details";
        const name = document.createElement("span");
        name.className = "attendee-name";
        name.textContent = rsvp.name + (rsvp.is_employee ? "" : " (Guest)");
        const status = document.createElement("span");
        status.className = "attendee-timestamp";
        status.textContent = rsvp.status === "yes" ? "Attending" : "Unable to Attend / Waitlist";
        details.append(name, status);

        const addButton = document.createElement("button");
        addButton.className = "edit-player-button";
        addButton.type = "button";
        addButton.textContent = "Add to Player List";
        addButton.setAttribute("aria-label", "Add " + rsvp.name + " to the player list");
        addButton.addEventListener("click", async function () {
          addButton.disabled = true;
          setMessage(unlistedRsvpsMessage, "Adding " + rsvp.name + " to the player list…", false);
          try {
            await request("/rest/v1/rpc/admin_add_rsvp_to_player_list", {
              method: "POST",
              body: JSON.stringify({ rsvp_name: rsvp.name })
            });
            await Promise.all([loadPlayers(), loadUnlistedRsvps()]);
            setMessage(unlistedRsvpsMessage, rsvp.name + " added to the player list.", false);
          } catch (error) {
            addButton.disabled = false;
            setMessage(unlistedRsvpsMessage, error.message || "Could not add the name to the player list.", true);
          }
        });
        item.append(details, addButton);
        unlistedRsvpsList.append(item);
      });
      setMessage(unlistedRsvpsMessage, "", false);
    } catch (error) {
      setMessage(unlistedRsvpsMessage, error.message || "Could not load names not on the player list.", true);
    } finally {
      refreshUnlistedRsvpsButton.disabled = false;
    }
  }

  function setMessage(element, text, isError) {
    element.textContent = text;
    element.classList.toggle("error", Boolean(isError));
  }

  function apiUrl(path) {
    return config.supabaseUrl.replace(/\/+$/, "") + path;
  }

  function apiHeaders() {
    return {
      apikey: config.supabaseAnonKey,
      Authorization: "Bearer " + (session ? session.access_token : config.supabaseAnonKey),
      "Content-Type": "application/json"
    };
  }

  async function request(path, options) {
    const response = await fetch(apiUrl(path), Object.assign({
      headers: apiHeaders()
    }, options || {}));
    if (!response.ok) {
      const body = await response.text();
      let detail = body;
      try {
        const error = JSON.parse(body);
        detail = error.message || error.msg || body;
      } catch (error) {
        detail = body;
      }
      if (detail === "Admin access required.") {
        throw new Error("Admin access required. In the Supabase SQL Editor, add the Supabase account email configured as adminEmail in config.js to public.admin_users, then sign out and sign in again.");
      }
      throw new Error(detail || "Request failed (HTTP " + response.status + ").");
    }
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function configuredAdminEmail() {
    return typeof config.adminEmail === "string" ? config.adminEmail.trim() : "";
  }

  function showManager() {
    loginPanel.hidden = true;
    managerPanel.hidden = false;
  }

  function showLogin() {
    session = null;
    sessionStorage.removeItem(storageKey);
    managerPanel.hidden = true;
    loginPanel.hidden = false;
  }

  function localDateValue(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function displaySessionDate(value) {
    return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  function switchAdminTab(tab) {
    const tabs = [
      [rosterTab, rosterTabPanel],
      [historyTab, historyTabPanel],
      [overviewTab, overviewTabPanel]
    ];
    tabs.forEach(function (entry) {
      const selected = entry[0] === tab;
      entry[0].setAttribute("aria-selected", String(selected));
      entry[0].tabIndex = selected ? 0 : -1;
      entry[1].hidden = !selected;
    });
    if (tab === historyTab) {
      loadAttendanceHistory();
    } else if (tab === overviewTab) {
      loadAttendanceOverview();
    }
  }

  function appendHistoryGroup(capture, status, heading) {
    const group = document.createElement("section");
    group.className = "attendance-history-group";
    const title = document.createElement("h4");
    title.textContent = heading;
    group.append(title);

    const entries = capture.players.filter(function (player) {
      return player.status === status;
    });
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "No names recorded.";
      group.append(empty);
      return group;
    }

    const list = document.createElement("ul");
    list.className = "attendance-list";
    entries.forEach(function (player) {
      const item = document.createElement("li");
      item.className = "attendee";
      const details = document.createElement("div");
      details.className = "attendee-details";
      const name = document.createElement("span");
      name.className = "attendee-name";
      name.textContent = player.name + (player.is_employee ? "" : " (Guest)");
      details.append(name);

      if (status === "yes") {
        const noShow = document.createElement("span");
        noShow.className = player.no_show ? "history-no-show" : "attendee-timestamp";
        noShow.textContent = player.no_show ? "Did not show up" : "No-show not recorded";
        details.append(noShow);

        const noShowButton = document.createElement("button");
        noShowButton.className = player.no_show ? "edit-player-button" : "remove-player-button";
        noShowButton.type = "button";
        noShowButton.textContent = player.no_show ? "Undo no-show" : "Mark no-show";
        noShowButton.setAttribute("aria-label", (player.no_show ? "Undo no-show for " : "Mark ") + player.name);
        noShowButton.addEventListener("click", async function () {
          noShowButton.disabled = true;
          setMessage(attendanceHistoryMessage, "Updating " + player.name + "…", false);
          try {
            await request("/rest/v1/rpc/admin_set_capture_no_show", {
              method: "POST",
              body: JSON.stringify({
                capture_player_id: player.id,
                did_not_show: !player.no_show
              })
            });
            const historyLoaded = await loadAttendanceHistory();
            if (historyLoaded) {
              setMessage(attendanceHistoryMessage, player.no_show
                ? player.name + " is no longer marked as a no-show."
                : player.name + " marked as a no-show.", false);
            }
          } catch (error) {
            noShowButton.disabled = false;
            setMessage(attendanceHistoryMessage, error.message || "Could not update the no-show record.", true);
          }
        });
        item.append(details, noShowButton);
      } else {
        item.append(details);
      }
      list.append(item);
    });
    group.append(list);
    return group;
  }

  async function loadAttendanceHistory() {
    refreshAttendanceHistoryButton.disabled = true;
    setMessage(attendanceHistoryMessage, "Loading attendance history…", false);
    attendanceHistoryList.replaceChildren();
    try {
      const rows = await request("/rest/v1/rpc/admin_list_attendance_captures", {
        method: "POST",
        body: "{}"
      });
      if (!Array.isArray(rows)) {
        throw new Error("Supabase returned an invalid attendance history.");
      }

      const captures = new Map();
      rows.forEach(function (row) {
        const id = String(row.capture_id);
        if (!captures.has(id)) {
          captures.set(id, {
            id: row.capture_id,
            date: row.session_date,
            capturedAt: row.captured_at,
            players: []
          });
        }
        if (row.capture_player_id !== null) {
          captures.get(id).players.push({
            id: row.capture_player_id,
            name: row.player_name,
            status: row.status,
            is_employee: row.is_employee,
            no_show: row.no_show
          });
        }
      });

      if (captures.size === 0) {
        setMessage(attendanceHistoryMessage, "No attendance captures yet. Use Capture Players to save the current list.", false);
        return true;
      }

      captures.forEach(function (capture) {
        const card = document.createElement("section");
        card.className = "attendance-capture";
        const heading = document.createElement("div");
        heading.className = "attendance-capture-heading attendance-capture-heading-row";
        const title = document.createElement("h3");
        title.textContent = displaySessionDate(capture.date);
        const timestamp = document.createElement("p");
        timestamp.textContent = "Captured " + new Date(capture.capturedAt).toLocaleString();
        const captureDetails = document.createElement("div");
        captureDetails.append(title, timestamp);
        const deleteButton = document.createElement("button");
        deleteButton.className = "remove-player-button";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete capture";
        deleteButton.setAttribute("aria-label", "Delete attendance capture for " + displaySessionDate(capture.date));
        deleteButton.addEventListener("click", function () {
          pendingCaptureId = capture.id;
          deleteCaptureMessage.textContent = "This permanently deletes the " +
            displaySessionDate(capture.date) + " capture and its " +
            capture.players.length + " saved player record" +
            (capture.players.length === 1 ? "" : "s") + ". This cannot be undone.";
          deleteCaptureDialog.showModal();
        });
        heading.append(captureDetails, deleteButton);
        card.append(
          heading,
          appendHistoryGroup(capture, "yes", "Attending"),
          appendHistoryGroup(capture, "unable", "Unable to Attend / Waitlist")
        );
        attendanceHistoryList.append(card);
      });
      setMessage(attendanceHistoryMessage, "", false);
      return true;
    } catch (error) {
      setMessage(attendanceHistoryMessage, error.message || "Could not load attendance history.", true);
      return false;
    } finally {
      refreshAttendanceHistoryButton.disabled = false;
    }
  }

  async function capturePlayers(date) {
    capturePlayersButton.disabled = true;
    setMessage(captureMessage, "Capturing the current attendance list…", false);
    try {
      const count = await request("/rest/v1/rpc/admin_capture_players", {
        method: "POST",
        body: JSON.stringify({ capture_date: date })
      });
      if (!Number.isInteger(count) || count < 0) {
        throw new Error("Capture request completed but Supabase did not return the number of captured players. Run the latest schema.sql, then try again.");
      }
      setMessage(captureMessage, "Captured " + count + " RSVP" + (count === 1 ? "" : "s") + " for " + displaySessionDate(date) + ".", false);
      switchAdminTab(historyTab);
    } catch (error) {
      setMessage(captureMessage, error.message || "Could not capture the players.", true);
    } finally {
      capturePlayersButton.disabled = false;
    }
  }

  async function loadAttendanceOverview() {
    setMessage(attendanceOverviewMessage, "Loading attendance overview…", false);
    attendanceOverviewBody.replaceChildren();
    try {
      const years = await request("/rest/v1/rpc/admin_list_attendance_years", {
        method: "POST",
        body: "{}"
      });
      if (!Array.isArray(years)) {
        throw new Error("Supabase returned an invalid attendance year list.");
      }
      const selectedYear = overviewYearInput.value;
      overviewYearInput.replaceChildren(new Option("All time", ""));
      years.forEach(function (entry) {
        const year = Number(entry.session_year);
        if (!Number.isInteger(year)) {
          throw new Error("Supabase returned an invalid attendance year.");
        }
        overviewYearInput.append(new Option(String(year), String(year)));
      });
      if (selectedYear && years.some(function (entry) {
        return String(entry.session_year) === selectedYear;
      })) {
        overviewYearInput.value = selectedYear;
      }

      const yearFilter = overviewYearInput.value === "" ? null : Number(overviewYearInput.value);
      const rows = await request("/rest/v1/rpc/admin_attendance_overview", {
        method: "POST",
        body: JSON.stringify({ year_filter: yearFilter })
      });
      if (!Array.isArray(rows)) {
        throw new Error("Supabase returned an invalid attendance overview.");
      }
      if (rows.length === 0) {
        setMessage(attendanceOverviewMessage, yearFilter === null
          ? "No attendance captures have been recorded yet."
          : "No attendance records found for " + yearFilter + ".", false);
        return;
      }
      rows.forEach(function (row) {
        const tableRow = document.createElement("tr");
        const name = document.createElement("th");
        name.scope = "row";
        name.textContent = row.player_name;
        tableRow.append(
          name,
          createOverviewCell(row.attended_count),
          createOverviewCell(row.unable_count),
          createOverviewCell(row.no_show_count)
        );
        attendanceOverviewBody.append(tableRow);
      });
      setMessage(attendanceOverviewMessage, rows.length + " player" +
        (rows.length === 1 ? "" : "s") + " in " +
        (yearFilter === null ? "all attendance history." : yearFilter + "."),
      false);
    } catch (error) {
      setMessage(attendanceOverviewMessage, error.message || "Could not load the attendance overview.", true);
    }
  }

  function createOverviewCell(value) {
    const cell = document.createElement("td");
    cell.textContent = String(value);
    return cell;
  }

  async function loadPlayers() {
    const players = await request("/rest/v1/players?select=id,name,is_guest&order=name.asc");
    playerList.replaceChildren();

    if (!players.length) {
      const empty = document.createElement("li");
      empty.className = "list-message";
      empty.textContent = "No players yet. Add the first one above.";
      playerList.append(empty);
      return;
    }

    players.forEach(function (player) {
      const item = document.createElement("li");
      item.className = "attendee";

      const name = document.createElement("span");
      name.className = "attendee-name";
      name.textContent = player.name + (player.is_guest ? " (Guest)" : "");

      const actions = document.createElement("div");
      actions.className = "player-actions";

      const editButton = document.createElement("button");
      editButton.className = "edit-player-button";
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.setAttribute("aria-label", "Edit " + player.name);
      editButton.addEventListener("click", function () {
        renderEditForm(item, player);
      });

      const removeButton = document.createElement("button");
      removeButton.className = "remove-player-button";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", "Remove " + player.name);
      removeButton.addEventListener("click", async function () {
        removeButton.disabled = true;
        setMessage(managerMessage, "Removing player…", false);
        try {
          await request("/rest/v1/rpc/admin_remove_player", {
            method: "POST",
            body: JSON.stringify({ player_id: player.id })
          });
          setMessage(managerMessage, player.name + " removed from the player list.", false);
          await loadPlayers();
        } catch (error) {
          removeButton.disabled = false;
          setMessage(managerMessage, error.message || "Could not remove player.", true);
        }
      });

      actions.append(editButton, removeButton);
      item.append(name, actions);
      playerList.append(item);
    });
  }

  async function loadPlayerLimit() {
    const settings = await request("/rest/v1/attendance_settings?select=max_players,attendance_status&id=eq.true");
    if (!settings.length) {
      throw new Error("Attendance settings are missing. Run the latest schema.sql in Supabase.");
    }
    currentPlayerLimit = settings[0].max_players;
    currentAttendanceStatus = settings[0].attendance_status;
    playerLimitInput.value = currentPlayerLimit === null ? "" : String(currentPlayerLimit);
    attendanceStatusInput.value = currentAttendanceStatus;
    updateAttendanceStatusIndicator();
  }

  function updateAttendanceStatusIndicator() {
    const details = {
      open: ["OPEN — RSVPs are being accepted", "open"],
      closed: ["CLOSED — no new RSVPs are being accepted", "closed"],
      locked: ["LOCKED — team places are fixed", "locked"]
    };
    attendanceStatusIndicator.textContent = details[currentAttendanceStatus][0];
    attendanceStatusIndicator.className = "attendance-status-indicator " + details[currentAttendanceStatus][1];
  }

  async function copyAttendanceList(status, button, label) {
    button.disabled = true;
    setMessage(copyListMessage, "Loading the latest " + label + "…", false);
    try {
      const rsvps = await request(
        "/rest/v1/rsvps?select=name,response_type,is_employee&status=eq." + status + "&order=created_at.asc,id.asc"
      );
      if (!Array.isArray(rsvps)) {
        throw new Error("Supabase returned an invalid attendance list.");
      }
      if (rsvps.length === 0) {
        setMessage(copyListMessage, "There are no names in the " + label + " to copy.", false);
        return;
      }

      const names = rsvps.map(function (rsvp) {
        return rsvp.name + (rsvp.response_type === "guest" && !rsvp.is_employee
          ? " (Guest)"
          : "");
      }).join("\n");
      try {
        await navigator.clipboard.writeText(names);
      } catch (clipboardError) {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = names;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.append(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) {
          throw new Error("Clipboard access was denied.");
        }
      }
      setMessage(copyListMessage, "Copied " + rsvps.length + " name" + (rsvps.length === 1 ? "" : "s") + " from the " + label + ".", false);
    } catch (error) {
      setMessage(copyListMessage, error.message || "Could not copy the " + label + ".", true);
    } finally {
      button.disabled = false;
    }
  }

  async function savePlayerLimit(limit) {
    savePlayerLimitButton.disabled = true;
    confirmLimitButton.disabled = true;
    setMessage(limitMessage, "Saving player limit…", false);
    try {
      await request("/rest/v1/rpc/admin_set_player_limit", {
        method: "POST",
        body: JSON.stringify({ player_limit: limit })
      });
      currentPlayerLimit = limit;
      playerLimitInput.value = limit === null ? "" : String(limit);
      setMessage(limitMessage, limit === null
        ? "Player limit removed. There is no limit."
        : currentAttendanceStatus === "locked"
          ? "Player limit set to " + limit + ". Existing team places remain locked."
          : "Player limit set to " + limit + ". Attendance has been updated.", false);
      limitWarningDialog.close();
    } catch (error) {
      setMessage(limitMessage, error.message || "Could not save the player limit.", true);
    } finally {
      savePlayerLimitButton.disabled = false;
      confirmLimitButton.disabled = false;
      pendingPlayerLimit = null;
    }
  }

  async function saveAttendanceStatus(status) {
    saveAttendanceStatusButton.disabled = true;
    setMessage(attendanceStatusMessage, "Saving attendance status…", false);
    try {
      await request("/rest/v1/rpc/admin_set_attendance_status", {
        method: "POST",
        body: JSON.stringify({ new_status: status })
      });
      currentAttendanceStatus = status;
      attendanceStatusInput.value = status;
      updateAttendanceStatusIndicator();
      const messages = {
        open: "Status set to Open. RSVPs are accepted with ASMPT employee priority.",
        closed: "Status set to Closed. No one can add an RSVP.",
        locked: "Status set to Locked. Current places are fixed."
      };
      setMessage(attendanceStatusMessage, messages[status], false);
    } catch (error) {
      attendanceStatusInput.value = currentAttendanceStatus;
      setMessage(attendanceStatusMessage, error.message || "Could not save the attendance status.", true);
    } finally {
      saveAttendanceStatusButton.disabled = false;
    }
  }

  function renderEditForm(item, player) {
    item.replaceChildren();
    const form = document.createElement("form");
    form.className = "edit-player-form";

    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Player name";
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 60;
    nameInput.value = player.name;
    nameInput.required = true;
    nameLabel.append(nameInput);

    const guestLabel = document.createElement("label");
    guestLabel.className = "checkbox-label";
    const guestInput = document.createElement("input");
    guestInput.type = "checkbox";
    guestInput.checked = player.is_guest;
    guestLabel.append(guestInput, document.createTextNode(" This player is a guest"));

    const actions = document.createElement("div");
    actions.className = "edit-player-actions";
    const saveButton = document.createElement("button");
    saveButton.className = "edit-player-button";
    saveButton.type = "submit";
    saveButton.textContent = "Save";
    const cancelButton = document.createElement("button");
    cancelButton.className = "remove-player-button";
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", loadPlayers);
    actions.append(saveButton, cancelButton);
    form.append(nameLabel, guestLabel, actions);
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        setMessage(managerMessage, "Enter a player name.", true);
        return;
      }

      saveButton.disabled = true;
      setMessage(managerMessage, "Saving player…", false);
      try {
        await request("/rest/v1/rpc/admin_update_player", {
          method: "POST",
          body: JSON.stringify({
            target_player_id: player.id,
            player_name: name,
            player_is_guest: guestInput.checked
          })
        });
        setMessage(managerMessage, name + " updated.", false);
        await loadPlayers();
      } catch (error) {
        saveButton.disabled = false;
        setMessage(managerMessage, error.message || "Could not update player.", true);
      }
    });
    item.append(form);
    nameInput.focus();
    nameInput.select();
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (!isConfigured()) {
      setMessage(loginMessage, "Add your Supabase project details in config.js first.", true);
      return;
    }

    const formData = new FormData(loginForm);
    const username = String(formData.get("username") || "").trim();
    const adminUsername = String(config.adminUsername || "ASMPT").trim();
    if (username.toLowerCase() !== adminUsername.toLowerCase()) {
      setMessage(loginMessage, "Incorrect username or password.", true);
      return;
    }
    if (!configuredAdminEmail()) {
      setMessage(loginMessage, "Set adminEmail in config.js to the email of your allowlisted Supabase admin account.", true);
      return;
    }

    loginButton.disabled = true;
    setMessage(loginMessage, "Signing in…", false);
    try {
      const response = await fetch(apiUrl("/auth/v1/token?grant_type=password"), {
        method: "POST",
        headers: {
          apikey: config.supabaseAnonKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: configuredAdminEmail(),
          password: formData.get("password")
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.msg || result.message || "Sign-in failed.");
      }
      session = result;
      sessionStorage.setItem(storageKey, JSON.stringify(session));
      await loadPlayers();
      await loadPlayerLimit();
      await loadUnlistedRsvps();
      showManager();
    } catch (error) {
      session = null;
      sessionStorage.removeItem(storageKey);
      setMessage(loginMessage, error.message || "Could not sign in.", true);
    } finally {
      loginButton.disabled = false;
    }
  });

  addPlayerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const name = newPlayerInput.value.trim();
    if (!name) {
      newPlayerInput.focus();
      setMessage(managerMessage, "Enter a player name.", true);
      return;
    }

    addPlayerButton.disabled = true;
    setMessage(managerMessage, "Adding player…", false);
    try {
      await request("/rest/v1/rpc/admin_add_player", {
        method: "POST",
        body: JSON.stringify({ player_name: name, player_is_guest: newPlayerGuest.checked })
      });
      newPlayerInput.value = "";
      newPlayerGuest.checked = false;
      setMessage(managerMessage, name + " added to the player list.", false);
      await loadPlayers();
    } catch (error) {
      setMessage(managerMessage, error.message || "Could not add player.", true);
    } finally {
      addPlayerButton.disabled = false;
    }
  });

  playerLimitForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const value = playerLimitInput.value.trim();
    const limit = value === "" ? null : Number(value);
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 1 || limit > 2147483647)) {
      playerLimitInput.focus();
      setMessage(limitMessage, "Enter a whole-number limit from 1 to 2,147,483,647, or leave it blank for no limit.", true);
      return;
    }

    if (limit !== null && (currentPlayerLimit === null || limit < currentPlayerLimit)) {
      pendingPlayerLimit = limit;
      limitWarningMessage.textContent = "Lowering the limit to " + limit +
        " may move players who currently have a place to Unable to Attend / Waitlist. Places are recalculated first-come-first-served, with ASMPT employees prioritized over guests.";
      limitWarningDialog.showModal();
      return;
    }

    await savePlayerLimit(limit);
  });

  attendanceStatusForm.addEventListener("submit", function (event) {
    event.preventDefault();
    saveAttendanceStatus(attendanceStatusInput.value);
  });

  copyAttendingButton.addEventListener("click", function () {
    copyAttendanceList("yes", copyAttendingButton, "attending list");
  });
  copyWaitlistButton.addEventListener("click", function () {
    copyAttendanceList("unable", copyWaitlistButton, "unable to attend list");
  });
  refreshUnlistedRsvpsButton.addEventListener("click", loadUnlistedRsvps);
  [rosterTab, historyTab, overviewTab].forEach(function (tab) {
    tab.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const tabs = [rosterTab, historyTab, overviewTab];
        const currentIndex = tabs.indexOf(tab);
        const offset = event.key === "ArrowRight" ? 1 : -1;
        const nextTab = tabs[(currentIndex + offset + tabs.length) % tabs.length];
        nextTab.focus();
        switchAdminTab(nextTab);
      }
    });
  });
  captureDateInput.value = localDateValue(new Date());
  capturePlayersForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!captureDateInput.value) {
      captureDateInput.focus();
      setMessage(captureMessage, "Choose a date to capture.", true);
      return;
    }
    capturePlayers(captureDateInput.value);
  });
  refreshAttendanceHistoryButton.addEventListener("click", loadAttendanceHistory);
  overviewYearInput.addEventListener("change", loadAttendanceOverview);
  overviewTab.addEventListener("click", function () {
    switchAdminTab(overviewTab);
  });
  rosterTab.addEventListener("click", function () {
    switchAdminTab(rosterTab);
  });
  historyTab.addEventListener("click", function () {
    switchAdminTab(historyTab);
  });
  document.getElementById("cancel-delete-capture").addEventListener("click", function () {
    pendingCaptureId = null;
    deleteCaptureDialog.close();
  });
  confirmDeleteCaptureButton.addEventListener("click", async function () {
    if (pendingCaptureId === null) {
      return;
    }
    confirmDeleteCaptureButton.disabled = true;
    setMessage(attendanceHistoryMessage, "Deleting attendance capture…", false);
    try {
      await request("/rest/v1/rpc/admin_delete_attendance_capture", {
        method: "POST",
        body: JSON.stringify({ target_capture_id: pendingCaptureId })
      });
      deleteCaptureDialog.close();
      pendingCaptureId = null;
      if (await loadAttendanceHistory()) {
        setMessage(attendanceHistoryMessage, "Attendance capture deleted.", false);
      }
    } catch (error) {
      setMessage(attendanceHistoryMessage, error.message || "Could not delete the attendance capture.", true);
    } finally {
      confirmDeleteCaptureButton.disabled = false;
    }
  });

  document.getElementById("cancel-limit-change").addEventListener("click", function () {
    pendingPlayerLimit = null;
    limitWarningDialog.close();
  });
  confirmLimitButton.addEventListener("click", function () {
    if (pendingPlayerLimit !== null) {
      savePlayerLimit(pendingPlayerLimit);
    }
  });

  document.getElementById("logout-button").addEventListener("click", showLogin);

  document.getElementById("open-reset-dialog").addEventListener("click", function () {
    resetDialog.showModal();
  });
  document.getElementById("cancel-reset-rsvps").addEventListener("click", function () {
    resetDialog.close();
  });
  confirmResetButton.addEventListener("click", async function () {
    confirmResetButton.disabled = true;
    setMessage(managerMessage, "Clearing all RSVPs…", false);
    try {
      const deletedCount = await request("/rest/v1/rpc/admin_reset_rsvps", {
        method: "POST",
        body: "{}"
      });
      if (!Number.isInteger(deletedCount) || deletedCount < 0) {
        throw new Error("Reset request completed but Supabase did not return the number of deleted RSVPs. Run the latest schema.sql, then try again.");
      }
      resetDialog.close();
      setMessage(managerMessage, deletedCount === 0
        ? "No RSVPs needed clearing. The player list is unchanged."
        : deletedCount + " RSVP" + (deletedCount === 1 ? "" : "s") + " cleared. The player list is unchanged.", false);
    } catch (error) {
      setMessage(managerMessage, error.message || "Could not reset RSVPs.", true);
    } finally {
      confirmResetButton.disabled = false;
    }
  });

  if (isConfigured()) {
    try {
      session = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch (error) {
      sessionStorage.removeItem(storageKey);
    }
  }

  if (session && session.access_token) {
    Promise.all([loadPlayers(), loadPlayerLimit(), loadUnlistedRsvps()]).then(showManager).catch(function (error) {
      setMessage(loginMessage, error.message || "Admin access could not be verified. Please sign in again.", true);
      showLogin();
    });
  }
}());
