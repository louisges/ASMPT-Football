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
  let session = null;

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

  document.getElementById("logout-button").addEventListener("click", showLogin);

  if (isConfigured()) {
    try {
      session = JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch (error) {
      sessionStorage.removeItem(storageKey);
    }
  }

  if (session && session.access_token) {
    loadPlayers().then(showManager).catch(function (error) {
      setMessage(loginMessage, error.message || "Admin access could not be verified. Please sign in again.", true);
      showLogin();
    });
  }
}());
