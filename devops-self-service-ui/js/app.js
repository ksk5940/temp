function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("collapsed");
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}

function simulateLoading(button, callback) {
  const originalText = button.innerText;
  button.disabled = true;
  button.innerText = "Processing...";

  setTimeout(() => {
    button.disabled = false;
    button.innerText = originalText;
    callback();
  }, 1500);
}

function confirmAction(message, callback) {
  if (confirm(message)) {
    callback();
  }
}

function formatStatus(status) {
  switch (status.toLowerCase()) {
    case "success":
      return `<span class="status success">Success</span>`;
    case "failed":
      return `<span class="status failed">Failed</span>`;
    case "pending":
      return `<span class="status pending">Pending</span>`;
    case "running":
      return `<span class="status running">Running</span>`;
    default:
      return `<span class="status">${status}</span>`;
  }
}