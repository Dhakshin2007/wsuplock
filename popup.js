/**************************************
 * popup.js
 **************************************/

// 1. Check for fingerprint sensor availability and remove fingerprint option if not available.
const unlockMethodSelect = document.getElementById("unlock-method");
if (
  window.PublicKeyCredential &&
  typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
) {
  PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
    .then((available) => {
      if (!available) {
        const fingerprintOption = unlockMethodSelect.querySelector(
          'option[value="fingerprint"]'
        );
        if (fingerprintOption) {
          fingerprintOption.remove();
        }
      }
    })
    .catch(() => {});
}

// 2. Get references to UI elements.
const textInputs = document.getElementById("text-inputs");
const patternSetup = document.getElementById("pattern-setup");
const fingerprintSetup = document.getElementById("fingerprint-setup");
const statusEl = document.getElementById("status");
const lockerActiveCheckbox = document.getElementById("locker-active");

// Global variable to store the pattern drawn by the user.
let currentPattern = [];

// 3. Apply theme based on system color scheme.
const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
applyTheme(isDarkMode);

function applyTheme(isDark) {
  // Update text input border and background colors.
  const inputs = document.querySelectorAll("#text-inputs input");
  inputs.forEach((input) => {
    input.style.border = `1px solid ${isDark ? 'white' : 'black'}`;
    input.style.backgroundColor = isDark ? '#333' : '#fff';
    input.style.color = isDark ? 'white' : 'black';
  });
  // Optionally, update any additional elements (like eye icon color) here.
}

// 4. Toggle visibility for input fields using an eye icon.
function toggleVisibility(inputField, toggleButton) {
  if (inputField.type === "password" || inputField.type === "number") {
    inputField.type = "text";
    toggleButton.textContent = "🙈";
  } else {
    // For PIN, revert to "number" type if needed.
    if (unlockMethodSelect.value === "pin") {
      inputField.type = "number";
    } else {
      inputField.type = "password";
    }
    toggleButton.textContent = "👁️";
  }
}

// 5. Set up eye toggle event listeners (if the elements exist).
document.getElementById("toggle-new")?.addEventListener("click", () => {
  const input = document.getElementById("new-credential");
  const toggleBtn = document.getElementById("toggle-new");
  toggleVisibility(input, toggleBtn);
});
document.getElementById("toggle-confirm")?.addEventListener("click", () => {
  const input = document.getElementById("confirm-credential");
  const toggleBtn = document.getElementById("toggle-confirm");
  toggleVisibility(input, toggleBtn);
});

// 6. When the user changes the unlock method, update the UI.
unlockMethodSelect.addEventListener("change", () => {
  const method = unlockMethodSelect.value;
  statusEl.textContent = "";
  resetTextFields();
  resetPatternGridUI();

  if (method === "password") {
    // Set inputs for password.
    textInputs.style.display = "block";
    document.getElementById("new-credential").type = "password";
    document.getElementById("confirm-credential").type = "password";
    document.getElementById("new-credential").placeholder = "Set Password";
    document.getElementById("confirm-credential").placeholder = "Confirm Password";
    patternSetup.style.display = "none";
    fingerprintSetup.style.display = "none";
  } else if (method === "pin") {
    // Set inputs for PIN; force number input.
    textInputs.style.display = "block";
    document.getElementById("new-credential").type = "number";
    document.getElementById("confirm-credential").type = "number";
    document.getElementById("new-credential").placeholder = "Set PIN (Only numbers are taken)";
    document.getElementById("confirm-credential").placeholder = "Confirm PIN (Only numbers are taken)";
    patternSetup.style.display = "none";
    fingerprintSetup.style.display = "none";
  } else if (method === "pattern") {
    textInputs.style.display = "none";
    fingerprintSetup.style.display = "none";
    patternSetup.style.display = "block";
    initPatternGrid();
  } else if (method === "fingerprint") {
    textInputs.style.display = "none";
    patternSetup.style.display = "none";
    fingerprintSetup.style.display = "block";
  }
});

// 7. Save Credential button logic.
document.getElementById("save-credential").addEventListener("click", async () => {
  const method = unlockMethodSelect.value;
  let credential = "";

  if (method === "password") {
    const newCredential = document.getElementById("new-credential").value.trim();
    const confirmCredential = document.getElementById("confirm-credential").value.trim();
    if (!newCredential) {
      statusEl.textContent = "Please enter a valid password.";
      return;
    }
    if (newCredential !== confirmCredential) {
      statusEl.textContent = "Passwords do not match.";
      return;
    }
    credential = newCredential;
  } else if (method === "pin") {
    const newCredential = document.getElementById("new-credential").value.trim();
    const confirmCredential = document.getElementById("confirm-credential").value.trim();
    // Check if the entered value is numeric.
    if (!/^\d+$/.test(newCredential)) {
      statusEl.textContent = "Only numbers are taken.";
      return;
    }
    if (newCredential !== confirmCredential) {
      statusEl.textContent = "Incorrect PIN.";
      return;
    }
    credential = newCredential;
  } else if (method === "pattern") {
    if (currentPattern.length === 0) {
      statusEl.textContent = "Please draw your pattern.";
      return;
    }
    credential = currentPattern.join(",");
  } else if (method === "fingerprint") {
    if (!localStorage.getItem("fingerprintRegistered")) {
      statusEl.textContent = "Please register your fingerprint first.";
      return;
    }
    credential = "fingerprint"; // Placeholder for fingerprint credential.
  }
  const credentialHash = await hashString(credential);
  chrome.storage.sync.set({ credentialHash, unlockMethod: method }, () => {
    statusEl.textContent = "Credential saved successfully!";
  });
});

// 8. Fingerprint registration (simulated using WebAuthn).
document.getElementById("register-fingerprint").addEventListener("click", async () => {
  try {
    const publicKey = {
      challenge: Uint8Array.from("registerChallenge", (c) => c.charCodeAt(0)),
      timeout: 60000,
      userVerification: "required",
    };
    const credential = await navigator.credentials.get({ publicKey });
    if (credential) {
      localStorage.setItem("fingerprintRegistered", "true");
      statusEl.textContent = "Fingerprint registered successfully!";
    }
  } catch (e) {
    statusEl.textContent = "Fingerprint registration failed.";
  }
});

// 9. Pattern grid initialization.
function initPatternGrid() {
  currentPattern = [];
  const grid = document.getElementById("pattern-grid");
  grid.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const dot = document.createElement("div");
    dot.className = "pattern-dot";
    dot.dataset.index = i;
    dot.style.width = "50px";
    dot.style.height = "50px";
    dot.style.border = `2px solid ${isDarkMode ? 'white' : 'black'}`;
    dot.style.borderRadius = "50%";
    dot.style.cursor = "pointer";
    dot.addEventListener("click", () => {
      if (!dot.getAttribute("data-selected")) {
        dot.style.backgroundColor = "blue";
        currentPattern.push(dot.dataset.index);
        dot.setAttribute("data-selected", "true");
      }
    });
    grid.appendChild(dot);
  }
}

// 10. Reset text inputs.
function resetTextFields() {
  document.getElementById("new-credential").value = "";
  document.getElementById("confirm-credential").value = "";
}

// 11. Reset pattern grid UI.
function resetPatternGridUI() {
  currentPattern = [];
  const grid = document.getElementById("pattern-grid");
  if (grid) grid.innerHTML = "";
}

// 12. Locker activation checkbox.
lockerActiveCheckbox.addEventListener("change", (e) => {
  chrome.storage.sync.set({ lockerActive: e.target.checked });
});

// Retrieve current locker active status on load.
chrome.storage.sync.get(["lockerActive"], (data) => {
  lockerActiveCheckbox.checked = data.lockerActive || false;
});

// 13. Helper function: Hash a string using SHA-256.
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
