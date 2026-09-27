const API_BASE = "http://127.0.0.1:8000";

let stats = { total: 0, attacks: 0, benign: 0 };
let monitoringInterval = null;
let feedCounter = 0;
let flowHistory = {};  // stores full result + rowIndex, keyed by feedCounter

function showError(msg) {
  const errorPanel = document.getElementById("errorPanel");
  errorPanel.textContent = "Error: " + msg;
  errorPanel.style.display = "block";
}

function clearError() {
  document.getElementById("errorPanel").style.display = "none";
}

async function analyzeOneFlow() {
  clearError();
  try {
    const sampleRes = await fetch(`${API_BASE}/sample/random`);
    if (!sampleRes.ok) throw new Error(`Sample fetch failed: ${sampleRes.status}`);
    const sampleData = await sampleRes.json();

    const predictRes = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: sampleData.features, explain: true })
    });

    if (!predictRes.ok) {
      const errBody = await predictRes.json();
      throw new Error(`Predict failed (${predictRes.status}): ${JSON.stringify(errBody.detail)}`);
    }

    const result = await predictRes.json();
    console.log("Prediction result:", result); // temporary debug line

    updateCurrentPanel(result, sampleData.row_index);
    updateStats(result.prediction);
    addToFeed(sampleData.row_index, result);

  } catch (err) {
    showError(err.message);
    console.error(err);
  }
}

function updateCurrentPanel(result, rowIndex) {
  document.getElementById("currentPanel").style.display = "grid";

  const verdictCard = document.getElementById("verdictCard");
  document.getElementById("verdictValue").textContent = result.prediction;
  document.getElementById("rowTag").textContent = `Test row #${rowIndex}`;
  verdictCard.className = "card " + (result.prediction === "ATTACK" ? "attack" : "benign");

  document.getElementById("confidenceValue").textContent = (result.attack_probability * 100).toFixed(2) + "%";
  document.getElementById("gaugeFill").style.width = (result.attack_probability * 100) + "%";

  const explanationList = document.getElementById("explanationList");
  explanationList.innerHTML = "";
  if (result.explanation) {
    result.explanation.forEach(item => {
      const li = document.createElement("li");
      const cls = item.shap_value > 0 ? "shap-pos" : "shap-neg";
      const arrow = item.shap_value > 0 ? "↑ toward attack" : "↓ toward benign";
      li.innerHTML = `<span>${item.feature}</span><span class="${cls}">${item.shap_value.toFixed(3)} (${arrow})</span>`;
      explanationList.appendChild(li);
    });
  }
}

function updateStats(prediction) {
  stats.total++;
  if (prediction === "ATTACK") stats.attacks++; else stats.benign++;

  document.getElementById("totalCount").textContent = stats.total;
  document.getElementById("attackCount").textContent = stats.attacks;
  document.getElementById("benignCount").textContent = stats.benign;
  document.getElementById("detectionRate").textContent =
    stats.total > 0 ? ((stats.attacks / stats.total) * 100).toFixed(1) + "%" : "0%";
}

function addToFeed(rowIndex, result) {
  feedCounter++;
  flowHistory[feedCounter] = { rowIndex, result };  // save for later lookup

  const tbody = document.getElementById("feedBody");
  const tr = document.createElement("tr");
  tr.dataset.feedId = feedCounter;
  tr.style.cursor = "pointer";

  const verdictClass = result.prediction === "ATTACK" ? "verdict-attack" : "verdict-benign";
  tr.innerHTML = `
    <td>${feedCounter}</td>
    <td>${rowIndex}</td>
    <td class="${verdictClass}">${result.prediction}</td>
    <td>${(result.attack_probability * 100).toFixed(2)}%</td>
  `;

  tr.addEventListener("click", () => {
    updateCurrentPanel(result, rowIndex);
  });

  tbody.insertBefore(tr, tbody.firstChild);

  // Keep feed + history in sync — trim old entries beyond 15
  while (tbody.rows.length > 15) {
    const lastRow = tbody.rows[tbody.rows.length - 1];
    delete flowHistory[lastRow.dataset.feedId];
    tbody.deleteRow(tbody.rows.length - 1);
  }
}

document.getElementById("analyzeOneBtn").addEventListener("click", analyzeOneFlow);

document.getElementById("startBtn").addEventListener("click", () => {
  document.getElementById("startBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
  analyzeOneFlow(); // run immediately, then repeat
  monitoringInterval = setInterval(analyzeOneFlow, 2000); // every 2 seconds
});

document.getElementById("stopBtn").addEventListener("click", () => {
  clearInterval(monitoringInterval);
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
});

document.getElementById("resetBtn").addEventListener("click", () => {
  stats = { total: 0, attacks: 0, benign: 0 };
  feedCounter = 0;
  document.getElementById("totalCount").textContent = "0";
  document.getElementById("attackCount").textContent = "0";
  document.getElementById("benignCount").textContent = "0";
  document.getElementById("detectionRate").textContent = "0%";
  document.getElementById("feedBody").innerHTML = "";
  document.getElementById("currentPanel").style.display = "none";
});