function goTo(page) {
  window.location.href = page;
}

function logout() {
  showToast("Logging out...");
  setTimeout(() => {
    window.location.href = "login.html";
  }, 1200);
}