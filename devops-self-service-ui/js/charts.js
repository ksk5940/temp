function renderDeploymentChart() {
  const bars = document.querySelectorAll(".chart-bar");

  const values = [92, 74, 58, 81];

  bars.forEach((bar, index) => {
    bar.style.height = values[index] + "%";
  });
}

function renderScanChart() {
  const scanBars = document.querySelectorAll(".scan-bar");

  const values = [95, 84, 76, 88, 66];

  scanBars.forEach((bar, index) => {
    bar.style.height = values[index] + "%";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderDeploymentChart();
  renderScanChart();
});