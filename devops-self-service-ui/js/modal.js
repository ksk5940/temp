function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "flex";
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = "none";
  }
}

window.onclick = function(event) {
  const modals = document.querySelectorAll(".modal");

  modals.forEach(modal => {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
};