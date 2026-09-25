const API_BASE = "http://127.0.0.1:8000";

document.getElementById("analyzeBtn").addEventListener("click", async () => {
  const rowIndex = document.getElementById("rowIndex").value;
  const errorPanel = document.getElementById("errorPanel");
  const resultPanel = document.getElementById("resultPanel");

  errorPanel.style.display = "none";
  resultPanel.style.display = "none";

  try {
    // Step 1: fetch a real sample row from the API
    const sampleRes = await fetch(`${API_BASE}/sample/${rowIndex}`);
    const sampleData = await sampleRes.json();

    if (sampleData.error) {
      throw new Error(sampleData.error);
    }

    // Step 2: send it to /predict
    const predictRes = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features: sampleData })
    });
    const result = await predictRes.json();

    // Step 3: display it
    const verdictCard = document.getElementById("verdictCard");
    const verdictValue = document.getElementById("verdictValue");
    const confidenceValue = document.getElementById("confidenceValue");
    const gaugeFill = document.getElementById("gaugeFill");

    verdictValue.textContent = result.prediction;
    confidenceValue.textContent = (result.attack_probability * 100).toFixed(2) + "%";
    gaugeFill.style.width = (result.attack_probability * 100) + "%";

    verdictCard.className = result.prediction === "ATTACK" ? "card attack" : "card benign";

    resultPanel.style.display = "grid";
  } catch (err) {
    errorPanel.textContent = "Error: " + err.message;
    errorPanel.style.display = "block";
  }
});