export let audioCtx;

function getFolderFromSymbols(symbols = []) {
	const set = new Set(symbols);

	const hasUp = set.has("octUp");
	const hasDown = set.has("octDown");
	const hasSharp = set.has("sharp");
	const hasFlat = set.has("flat");

	if (hasUp && hasSharp) return "High sharps";
	if (hasUp && hasFlat) return "High flats";
	if (hasDown && hasSharp) return "Low sharps";
	if (hasDown && hasFlat) return "Low flats";

	if (hasUp) return "High";
	if (hasDown) return "Low";
	if (hasSharp) return "Sharp";
	if (hasFlat) return "Flats";

	return "Mid";
}

const volumeRangeEle = document.getElementById('volumeRange');
volumeRangeEle.value = localStorage.getItem("volume") ?? volumeRangeEle.value;
volumeRangeEle.addEventListener("input", () => {
	localStorage.setItem("volume", volumeRangeEle.value);
});

export function playNote(noteInput, when) {

	if (!Array.isArray(noteInput) || noteInput.length < 1) return;

	const note = noteInput.at(-1);
	const symbols = noteInput.slice(0, -1);

	const folder = getFolderFromSymbols(symbols);
	const key = `${folder}_${note}`;

	const bufferList = audioPool?.[key];
	if (!bufferList) return;

	const index = poolIndex[key];

	const source = audioCtx.createBufferSource();
	source.buffer = bufferList[index];

	const gainNode = audioCtx.createGain();

	const volumeValue = Number(volumeRangeEle.value || 10);
	gainNode.gain.value = volumeValue / 5;

	source.connect(gainNode);
	gainNode.connect(audioCtx.destination);

	source.start(when);

	poolIndex[key] = (index + 1) % 32;

	console.log(`${folder}/${note}`);
}

/* Preload audio */

let audioPool = null;
let poolIndex = null;
let loadingPromise = null;

const skipLoad = new Set([
	"Low flats_D",
	"High flats_G",
]);

async function loadBuffer(url) {
	const res = await fetch(url);
	if (!res.ok) return null;

	const arrayBuffer = await res.arrayBuffer();
	return await audioCtx.decodeAudioData(arrayBuffer);
}

export async function ensureAudioLoaded(requiredNotes = []) {
	if (!audioCtx) {
		audioCtx = new(window.AudioContext || window.webkitAudioContext)()
	}


	if (!audioPool) {
		audioPool = {};
		poolIndex = {};
	}

	const needed = new Map();

	for (const noteArr of requiredNotes) {
		if (!Array.isArray(noteArr) || noteArr.length < 1) continue;

		const note = noteArr.at(-1);
		const symbols = noteArr.slice(0, -1);

		const folder = getFolderFromSymbols(symbols);
		const key = `${folder}_${note}`

		needed.set(key, { folder, note, key });
	}

	if (loadingPromise) return loadingPromise;

	loadingPromise = (async () => {
		document.body.classList.add("waiting");

		for (const { folder, note, key } of needed.values()) {
			if (audioPool[key]) continue;
			if (skipLoad.has(key)) continue;

			const url = `Sounds/${folder}/${note}.opus`;

			const buffer = await loadBuffer(url);
			if (!buffer) continue;

			audioPool[key] = Array.from({
				length: 32
			}, () => buffer);
			poolIndex[key] = 0;
		}
		document.body.classList.remove("waiting");
	})();

	const result = loadingPromise;
	loadingPromise = null;

	return result;
}