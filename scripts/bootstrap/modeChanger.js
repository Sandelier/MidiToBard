// Mode change

const modeButtons = document.querySelectorAll("#modeContainer button");
const modeName = document.getElementById('modeName');


const modeInputs = {
	midi: document.getElementById("midiDrop"),
	oseq: document.getElementById("onlineSequencerInput")
};

modeInputs.oseq.value = "";

const parserSettingsEle = document.getElementById('parserSettings');
let currentMode = null;

async function setMode(selectedMode) {
	if (selectedMode === currentMode) return;
	currentMode = selectedMode;

	Object.entries(modeInputs).forEach(([mode, el]) => {
		el.style.display = (mode === selectedMode) ? "block" : "none";
	});

	modeButtons.forEach(btn => {
		btn.classList.toggle("modeSelected", btn.dataset.mode === selectedMode);
	});

	parserSettingsEle.querySelector(".name").value = "";
	parserSettingsEle.querySelector(".bpm").value = "";
	parserSettingsEle.querySelector(".octave").value = "0";
	parserSettingsEle.querySelector(".notes").textContent = "";
	parserSettingsEle.querySelector(".songLength").textContent = "";
	parserSettingsEle.style.display = "none"

	if (selectedMode === "midi") {
		modeName.textContent = "Midi";
		parserSettingsEle.querySelector(".songLength").parentElement.style.display = "flex";
        await import("../midiParser.js");

	} else if (selectedMode === "oseq") {
		modeName.textContent = "Online sequencer";
		parserSettingsEle.querySelector(".songLength").parentElement.style.display = "none";
        await import("../sequencerParser.js");
	}

	document.getElementById('converter').style.display = "none";
}

modeButtons.forEach(btn => {
	btn.addEventListener("click", () => {
		setMode(btn.dataset.mode);
	});
});