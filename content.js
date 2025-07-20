// On load, retrieve settings from storage
chrome.storage.sync.get(["lockerActive", "unlockMethod", "credentialHash"], (data) => {
    if (data.lockerActive && data.unlockMethod && data.credentialHash) {
      showLockOverlay(data.unlockMethod);
    }
  });
  
  function showLockOverlay(method) {
    let html = "";
    switch(method) {
      case "password":
        html = `
          <div class="locker-container">
            <h2>Enter Password</h2>
            <input type="password" id="locker-input" placeholder="Password" />
            <button id="locker-unlock">Unlock</button>
            <p id="locker-msg"></p>
          </div>`;
        break;
      case "pin":
        html = `
          <div class="locker-container">
            <h2>Enter PIN</h2>
            <input type="number" id="locker-input" placeholder="PIN" />
            <button id="locker-unlock">Unlock</button>
            <p id="locker-msg"></p>
          </div>`;
        break;
      case "pattern":
        html = `
          <div class="locker-container">
            <h2>Draw Pattern</h2>
            <div id="pattern-grid"></div>
            <button id="locker-unlock">Unlock</button>
            <p id="locker-msg"></p>
          </div>`;
        break;
      case "fingerprint":
        html = `
          <div class="locker-container">
            <h2>Fingerprint Authentication</h2>
            <button id="fingerprint-auth">Authenticate</button>
            <p id="locker-msg"></p>
          </div>`;
        break;
      default:
        // Fallback to password if method is unknown
        html = `
          <div class="locker-container">
            <h2>Enter Password</h2>
            <input type="password" id="locker-input" placeholder="Password" />
            <button id="locker-unlock">Unlock</button>
            <p id="locker-msg"></p>
          </div>`;
    }
  
    // Create overlay container
    const overlay = document.createElement("div");
    overlay.id = "wa-locker-overlay";
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
  
    // Add event listeners based on method
    if (method === "fingerprint") {
      document.getElementById("fingerprint-auth").addEventListener("click", fingerprintAuth);
    } else if (method === "pattern") {
      initPatternGrid(); // Initialize a simple grid for pattern input
      document.getElementById("locker-unlock").addEventListener("click", verifyPattern);
    } else {
      document.getElementById("locker-unlock").addEventListener("click", () => {
        verifyCredential(method);
      });
    }
  }
  
  // Verification for password or PIN unlock
  async function verifyCredential(method) {
    const inputVal = document.getElementById("locker-input").value;
    chrome.storage.sync.get(["credentialHash"], async (result) => {
      const storedHash = result.credentialHash;
      const inputHash = await hashString(inputVal);
      if (inputHash === storedHash) {
        // Correct credential => remove overlay
        document.getElementById("wa-locker-overlay").remove();
      } else {
        document.getElementById("locker-msg").innerText = "Incorrect " + method + ". Try again.";
      }
    });
  }
  
  // Fingerprint authentication using WebAuthn API
  async function fingerprintAuth() {
    try {
      const publicKey = {
        challenge: Uint8Array.from("randomChallengeString", c => c.charCodeAt(0)),
        timeout: 60000,
        userVerification: "required"
      };
      const credential = await navigator.credentials.get({ publicKey });
      if (credential) {
        // If successful, remove overlay
        document.getElementById("wa-locker-overlay").remove();
      }
    } catch (e) {
      document.getElementById("locker-msg").innerText = "Fingerprint authentication failed.";
    }
  }
  
  // Pattern unlock functions
  function initPatternGrid() {
    const grid = document.getElementById("pattern-grid");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3, 50px)";
    grid.style.gridGap = "10px";
    grid.style.justifyContent = "center";
  
    // Create 9 dots
    for (let i = 0; i < 9; i++) {
      let dot = document.createElement("div");
      dot.className = "pattern-dot";
      dot.dataset.index = i;
      dot.style.width = "50px";
      dot.style.height = "50px";
      dot.style.border = "2px solid #333";
      dot.style.borderRadius = "50%";
      dot.style.cursor = "pointer";
  
      dot.addEventListener("click", () => {
        if (!dot.getAttribute("data-selected")) {
          dot.style.backgroundColor = "blue";
          dot.setAttribute("data-selected", "true");
          window.enteredPattern.push(dot.dataset.index);
        }
      });
      grid.appendChild(dot);
    }
  
    // Initialize the global pattern array
    window.enteredPattern = [];
  }
  
  async function verifyPattern() {
    // Retrieve the stored pattern hash from storage
    chrome.storage.sync.get(["credentialHash"], async (result) => {
      const storedHash = result.credentialHash;
  
      // Combine clicked dot indices into a comma-separated string
      const enteredPatternStr = window.enteredPattern ? window.enteredPattern.join(",") : "";
      // Hash the user-entered pattern
      const enteredHash = await hashString(enteredPatternStr);
  
      if (enteredHash === storedHash) {
        // Pattern is correct => remove overlay
        document.getElementById("wa-locker-overlay").remove();
        window.enteredPattern = [];
      } else {
        // Incorrect => show error and reset the grid
        document.getElementById("locker-msg").innerText = "Incorrect pattern. Try again.";
        resetPatternGrid();
      }
    });
  }
  
  function resetPatternGrid() {
    const dots = document.querySelectorAll(".pattern-dot");
    dots.forEach(dot => {
      dot.style.backgroundColor = "";
      dot.removeAttribute("data-selected");
    });
    window.enteredPattern = [];
  }
  
  // Helper function: hash strings using SHA-256
  async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  