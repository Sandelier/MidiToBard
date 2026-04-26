export function showOverlay() {
	const overlay = document.getElementById('overlay');
	overlay.style.display = "flex";
	overlay.offsetHeight; // forcing reflow so the transition works for the first time

	overlay.classList.add("active");
	document.getElementById('playTrack').style.display = "none";

	Array.from(document.getElementById('overlayContainer').children).forEach(child => {
		child.style.display = "none";
	});

	document.getElementById('closeOverlay').style.display = "";

	document.getElementById('siteContainer').style.display = "none";
}

function closeOverlay() {
	overlay.classList.remove("active");
	document.getElementById('siteContainer').style.display = "";
}

document.getElementById('closeOverlay').addEventListener("click", closeOverlay);

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && overlay.style.display !== "none") {
		closeOverlay();
	}
});