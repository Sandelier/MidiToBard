const converterEle = document.getElementById('converter');
const thresholdEle = converterEle.querySelector('.threshold');
const maxLengthEle = converterEle.querySelector('.maxLength');
const modsDropdownEle = document.getElementById('modsDropdown');

const parserEle = document.getElementById('parser');
const nameEle = parserEle.querySelector('.name');
const bpmEle = parserEle.querySelector('.bpm');
const octaveEle = parserEle.querySelector('.octave');

export let rawBardNotes = null;
let processedNotes = null;
let bpmForConversion = null;

let convertToBard;
let modifyNotes = true;

export async function main() {
	const currentMode = document.querySelector('#modeContainer .modeSelected').dataset.mode

	const octaveChange = parseInt(octaveEle.value, 10) || 0;

	let getHighestNote;
	let groupByDelay;
	({ convertToBard, groupByDelay, getHighestNote } = await import("./noteMapper.js"));

	if (currentMode === "oseq") {
		const { onlineSequencerNotes } = await import("./sequencerParser.js");
		const bpm = bpmEle.value > 0 ? bpmEle.value : 120;
		const delayPerSpace = 60 / bpm / 4;

		const grouped = groupByDelay(onlineSequencerNotes);

		processedNotes = [...grouped.entries()]
			.map(([delay, notes]) => ({
				note: shiftOctave(getHighestNote(notes), octaveChange),
				delay: parseFloat((delay * delayPerSpace))
			}))
			.sort((a, b) => a.delay - b.delay);

		let accumulatedDelay = 0;
		processedNotes = processedNotes.map(item => {
			const relativeDelay = item.delay - accumulatedDelay;
			accumulatedDelay += relativeDelay;

			return {
				...item,
				delay: relativeDelay
			};
		});

		bpmForConversion = null;

	} else if (currentMode === "midi") {
		const { midi } = await import("./midiParser.js");
		processedNotes = midi.tracks
			.flatMap(track => track.notes)
			.map(note => ({
				note: shiftOctave(note.name, octaveChange),
				delay: note.time
			}))
			.sort((a, b) => a.delay - b.delay);

		bpmForConversion = midi.header.tempos.length ? midi.header.tempos[0].bpm.toFixed(0) : 120;
	} else {
		console.error("Unknown mode");
		return;
	}

	modsDropdownEle.style.display = "";
	rawBardNotes = convertToBard(processedNotes, bpmForConversion, modifyNotes);

	converterEle.querySelector('.name').value = nameEle.value;
	converterEle.querySelector('.notes').textContent = rawBardNotes.length;

	converterEle.querySelector('.songLength').textContent = rawBardNotes
		.reduce((sum, note) => sum + (note.delay || 0), 0)
		.toFixed(2)
		+ "s";

	const groupedNotes = groupNotes(rawBardNotes);
	thresholdEle.value = groupedNotes.threshold;
	maxLengthEle.value = groupedNotes.maxLength;

	converterEle.style.display = "flex";
	const parserHeight = parserEle.getBoundingClientRect().height;
	const converterHeight = converterEle.getBoundingClientRect().height;

	if (converterHeight < parserHeight) {
		converterEle.style.height = parserHeight + "px";
	} else {
		converterEle.style.height = "";
	}

	modifyNotes = true;
	preloadAudio();
}

// songNotes should be converted to bard notes before calling this function
export async function directProcess(songNotes, rawSongNotes, name) {
	rawBardNotes = songNotes;
	processedNotes = rawSongNotes;
	modifyNotes = false;
	// We should still set it so other functions can use converttobard
	({ convertToBard } = await import("./noteMapper.js"));

	converterEle.querySelector(".name").value = name;
	converterEle.querySelector(".notes").textContent = rawBardNotes.length;

	converterEle.querySelector(".songLength").textContent = rawBardNotes
		.reduce((sum, note) => sum + (note.delay || 0), 0)
		.toFixed(2)
		+ "s";

	const groupedNotes = groupNotes(rawBardNotes);
	thresholdEle.value = groupedNotes.threshold;
	maxLengthEle.value = groupedNotes.maxLength;

	modsDropdownEle.style.display = "none";
	converterEle.style.display = "flex";

	preloadAudio();
}

// Preloading all the soundfiles so theres no wait for preview since decoding takes a while
async function preloadAudio() {
	let { ensureAudioLoaded } = await import("./audioPlayer.js");
	const seen = new Set();
	const uniqueNotes = rawBardNotes
		.filter(item => {
			if (seen.has(item.note)) return false;
			seen.add(item.note);
			return true;
		})
		.map(item => item.build);

	await ensureAudioLoaded(uniqueNotes);
}


function shiftOctave(note, octaveChange) {
	const match = note.match(/^([A-G]#?)(-?\d+)$/);
	if (!match) return note;

	const pitch = match[1];
	const octave = Number(match[2]);

	return pitch + (octave + octaveChange);
}

export function groupNotes(bardNotes, options = {}) {
	if (!Array.isArray(bardNotes) || bardNotes.length === 0) {
		return {
			notes: "",
			delays: [],
			threshold: 0,
			maxLength: 10
		};
	}

	const delays = bardNotes.map(e => e.delay || 0);

	const sorted = [...delays].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	const medianDelay = sorted.length % 2 ?
		sorted[mid] :
		(sorted[mid - 1] + sorted[mid]) / 2;

	const defaultThreshold = medianDelay ? (medianDelay / 1.5) * 2 : 0;
	const defaultMaxLength = 10;

	const threshold =
		typeof options.threshold === "number" &&
		Number.isFinite(options.threshold) &&
		options.threshold > 0 ?
		options.threshold :
		defaultThreshold;

	const maxLength =
		Number.isInteger(options.maxLength) &&
		options.maxLength > 0 ?
		options.maxLength :
		defaultMaxLength;

	const groups = [];
	let noteGroup = [];
	let delayGroup = [];

	bardNotes.forEach((entry, i) => {
		const delay = delays[i];
		const note = entry.note || "";

		if (delay > threshold && noteGroup.length) {
			groups.push({
				notes: noteGroup,
				delays: delayGroup
			});
			noteGroup = [];
			delayGroup = [];
		}

		noteGroup.push(note);
		delayGroup.push(delay);
	});

	if (noteGroup.length) {
		groups.push({
			notes: noteGroup,
			delays: delayGroup
		});
	}

	const lines = [];
	const finalDelays = [];

	groups.forEach(group => {
		const n = group.notes.length;
		const needsBrackets = n > maxLength;

		for (let i = 0; i < n; i += maxLength) {
			const subNotes = group.notes.slice(i, i + maxLength);
			const subDelays = group.delays.slice(i, i + maxLength);

			if (needsBrackets) {
				if (i === 0) subNotes[0] = "[" + subNotes[0];
				if (i + maxLength >= n) subNotes[subNotes.length - 1] += "]";
			}

			lines.push(subNotes.join("\t"));

			finalDelays.push(...subDelays);
		}
	});

	return {
		notes: lines.join("\n").replace(/^[\t\n]+/, ""),
		delays: finalDelays,
		threshold: threshold,
		maxLength: maxLength
	};
}

// Device change
const deviceSelect = converterEle.querySelector('.device');
const savedDevice = localStorage.getItem('device');
if (savedDevice) {
	deviceSelect.value = savedDevice;
}

deviceSelect.addEventListener('change', () => {
	localStorage.setItem('device', deviceSelect.value);

	rawBardNotes = convertToBard(processedNotes, bpmForConversion, modifyNotes);
});

document.querySelectorAll("#modsMenu input[type='checkbox']");

// Modifier change
const modsBtn = document.getElementById("modsBtn");
const modsMenu = document.getElementById("modsMenu");
const modsBoxes = modsMenu.querySelectorAll("input[type='checkbox']");

modsBtn.addEventListener("click", (e) => {
	e.stopPropagation();
	modsMenu.classList.toggle("show");
});

document.addEventListener("click", (e) => {
	if (!modsBtn.contains(e.target) && !modsMenu.contains(e.target)) {
		modsMenu.classList.remove("show");
	}
});

modsMenu.addEventListener("click", (e) => {
	e.stopPropagation();
});

modsBoxes.forEach(cb => {
	cb.addEventListener("change", () => {
		rawBardNotes = convertToBard(processedNotes, bpmForConversion, modifyNotes);
	});
});