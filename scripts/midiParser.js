export let midi = null;

let toneMidiLoaded = false;
function loadToneJS() {
	return new Promise((resolve, reject) => {
		if (toneMidiLoaded || window.Midi) {
			toneMidiLoaded = true;
			return resolve();
		}

		const script = document.createElement("script");
        // https://unpkg.com/@tonejs/midi@2.0.28/build/Midi.js
		script.src = "libs/tonejs-midi-2.0.28.js";
		script.onload = () => {
			toneMidiLoaded = true;
			resolve();
		};
		script.onerror = reject;
		document.head.appendChild(script);
	});
}

const midiDropEle = document.getElementById('midiDrop');

async function handleFile(file) {
	if (!file) return;

	if (!file.name.endsWith(".mid") && !file.name.endsWith(".midi")) {
		return;
	}

	try {
		await loadToneJS();

		const arrayBuffer = await file.arrayBuffer();
		midi = new Midi(arrayBuffer);
	} catch (error) {
		console.log(error);
		return;
	}

	const noteCount = midi.tracks.reduce(
		(sum, track) => sum + track.notes.length,
		0
	);

	const orginalBpm = midi.header.tempos.length ? midi.header.tempos[0].bpm.toFixed(0) : 120;

	const parserSettingsEle = document.getElementById('parserSettings')
	parserSettingsEle.querySelector('.octave').value = 0;
	parserSettingsEle.querySelector('.name').value = file.name.replace(/\.(mid|midi)$/i, "");;
	parserSettingsEle.querySelector('.bpm').value = orginalBpm
	parserSettingsEle.querySelector('.notes').textContent = noteCount;
	parserSettingsEle.querySelector('.songLength').textContent = midi.duration.toFixed(2) + "s";

	parserSettingsEle.style.display = "flex"
}

// Listeners

// Drag and drop
midiDropEle.addEventListener("dragover", (e) => {
	midiDropEle.style.backgroundColor = "#454b4e";
	e.preventDefault();
});

midiDropEle.addEventListener("dragleave", (e) => {
	midiDropEle.style.backgroundColor = "";
});

midiDropEle.addEventListener("drop", async (e) => {
	e.preventDefault();
	midiDropEle.style.backgroundColor = "";

	const file = e.dataTransfer.files[0];
	await handleFile(file);
});

// Input
const midiInput = document.createElement("input");
midiInput.type = "file";
midiInput.accept = ".mid,.midi";
midiInput.style.display = "none";
document.body.appendChild(midiInput);

midiDropEle.addEventListener("click", () => {
	midiInput.click();
});

midiInput.addEventListener("change", async (e) => {
	const file = e.target.files[0];
	await handleFile(file);
});