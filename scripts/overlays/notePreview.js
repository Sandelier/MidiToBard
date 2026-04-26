const overlay = document.getElementById('overlay');
const bardNoteContainer = document.getElementById('bardNoteContainer')

const converterEles = {
	threshold: document.querySelector('#converter .threshold'),
	maxLength: document.querySelector('#converter .maxLength')
}

const trackControlEles = {
	trackControls: document.getElementById('trackControls'),
	maxLength: document.querySelector('#trackControls .maxLength'),
	threshold: document.querySelector('#trackControls .threshold')
}

/* Note rendering */

let groupNotes, rawBardNotes;

export async function main() {
    ({ groupNotes, rawBardNotes } = await import("../noteProcessor.js"));

    const { notes, delays } = groupNotes(rawBardNotes, {
        threshold: parseFloat(converterEles.threshold.value),
        maxLength: parseInt(converterEles.maxLength.value)
    });

    (await import("./overlayController.js")).showOverlay();

    bardNoteContainer.style.display = "";
    document.getElementById("playTrack").style.display = "flex";

    renderNotes(notes, delays);

    trackControlEles.maxLength.value = converterEles.maxLength.value;
    trackControlEles.threshold.value = converterEles.threshold.value;
}

function renderNotes(notesString, delays) {
	bardNoteContainer.innerHTML = "";

	const fragment = document.createDocumentFragment();

	const rows = notesString.split("\n");
	let noteIndex = 0;

	rows.forEach((row) => {
		const rowDiv = document.createElement("div");
		rowDiv.classList.add("note-row");

		rowDiv.style.gridTemplateColumns = `repeat(${converterEles.maxLength.value}, 1fr)`;

		const notes = row.split("\t");

		notes.forEach((note) => {
        	const noteSpan = document.createElement("span");
        	noteSpan.classList.add("note");

        	noteSpan.dataset.index = noteIndex;

        	if (noteIndex > 0 && delays[noteIndex] <= 0.1) {
        		noteSpan.classList.add("veryLowDelay");
        	} else if (noteIndex > 0 && delays[noteIndex] <= 0.2) {
        		noteSpan.classList.add("lowDelay");
        	} else if (noteIndex > 0 && delays[noteIndex] >= 1) {
        		noteSpan.classList.add("longDelay");
        	}
        
        	let noteText = note;
        
        	if (noteText.startsWith("[")) {
        		const bracket = document.createElement("span");
        		bracket.classList.add("noteBracket");
        		bracket.textContent = "[";
        		noteSpan.appendChild(bracket);
            
        		noteText = noteText.slice(1);
        	}
        
        	let lastBracket = null;
        	if (noteText.endsWith("]")) {
        		lastBracket = document.createElement("span");
        		lastBracket.classList.add("noteBracket");
        		lastBracket.textContent = "]";
            
        		noteText = noteText.slice(0, -1);
        	}
        
        	if (noteText.length > 0) {
        		noteSpan.appendChild(document.createTextNode(noteText));
        	}
        
        	if (lastBracket) {
        		noteSpan.appendChild(lastBracket);
        	}

        	noteIndex++;
        	rowDiv.appendChild(noteSpan);
        });

		fragment.appendChild(rowDiv);
	});

	bardNoteContainer.appendChild(fragment);
}

function updateNoteHighlights() {
	const notes = document.querySelectorAll("#bardNoteContainer .note");

	notes.forEach(note => {
		const i = parseInt(note.dataset.index, 10);

		note.style.color = "";
		if (i < scheduledIndex) {
			note.style.color = "#2ecc71";
		}

		if (i === scheduledIndex) {
			note.style.color = "#00d9ff";
			note.scrollIntoView({
				behavior: "smooth",
				block: "center"
			});
		}
	});
}

// Scheduler
let timeline = [];
let songDuration = 0;

let isPlaying = false;
let startCtxTime = 0;
let pauseTime = 0;
let scheduledIndex = 0;

let lastIndex = -1;

let schedulerTimer = null;

function scheduler() {
	if (!isPlaying) return;

	const now = audioCtx.currentTime;
	const songTime = now - startCtxTime;

	while (
		scheduledIndex < timeline.length &&
		timeline[scheduledIndex].time <= songTime + 0.2
	) {
		const event = timeline[scheduledIndex];
		const when = startCtxTime + event.time;

		playNote(event.build, when);

		scheduledIndex++;
	}

	if (scheduledIndex !== lastIndex) {
		lastIndex = scheduledIndex;
		noteLabel.textContent = scheduledIndex + 1;
		updateNoteHighlights();
	}
}

function updateTrackWhilePlaying() {
	if (isPlaying && songDuration) {
		const songTime = audioCtx.currentTime - startCtxTime;

		const percent = (songTime / songDuration) * 100;
		setTrackPercent(percent);

	}

	requestAnimationFrame(updateTrackWhilePlaying);
}
updateTrackWhilePlaying()

const progress = document.getElementById("track-progress");
const head = document.getElementById("track-head");
const noteLabel = document.getElementById("track-head-label");
const track = document.getElementById("track");

let isDragging = false;

function clamp(v, a, b) {
	return Math.max(a, Math.min(b, v));
}

function setTrackPercent(percent) {
	percent = clamp(percent, 0, 100);

	progress.style.width = percent + "%";
	head.style.left = percent + "%";
	noteLabel.style.left = percent + "%";
}

function getPercentFromEvent(e) {
	const rect = track.getBoundingClientRect();
	const x = e.clientX - rect.left;
	return clamp((x / rect.width) * 100, 0, 100);
}

function getNearestNoteIndex(targetTime) {
	if (!timeline.length) return 0;

	let bestIndex = 0;
	let bestDist = Infinity;

	for (let i = 0; i < timeline.length; i++) {
		const dist = Math.abs(timeline[i].time - targetTime);

		if (dist < bestDist) {
			bestDist = dist;
			bestIndex = i;
		}
	}

	return bestIndex;
}

function headSeek(percent) {
	if (!timeline.length) return;

	isPlaying = false;

	const rawTime = (percent / 100) * songDuration;

	const index = getNearestNoteIndex(rawTime);
	const snappedTime = timeline[index].time;

	pauseTime = snappedTime;

	scheduledIndex = index;

	setTrackPercent((snappedTime / songDuration) * 100);

	noteLabel.textContent = scheduledIndex + 1;
	updateNoteHighlights()
}

function seekToNote(index) {
	if (!timeline.length) return;

	index = Math.max(0, Math.min(index, timeline.length - 1));

	const targetTime = timeline[index].time;

	pauseTime = targetTime;

	const percent = (targetTime / songDuration) * 100;
	setTrackPercent(percent);

	scheduledIndex = index;

	if (isPlaying) {
		startCtxTime = audioCtx.currentTime - pauseTime;
	}

	noteLabel.textContent = scheduledIndex + 1;
	updateNoteHighlights()
}

// Song reset on close
function resetSong() {
	isPlaying = false;
	startCtxTime = 0;
	pauseTime = 0;
	scheduledIndex = 0;
	setTrackPercent(0);
	timeline = [];
	noteLabel.textContent = "0";
}

document.getElementById('closeOverlay').addEventListener("click", resetSong);

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && overlay.style.display !== "none") {
		resetSong();
	}
});

// Listeners

function ensureTimeline() {
	if (!timeline.length) {

		let t = 0;
		timeline = rawBardNotes.map(n => (t += n.delay, {
			note: n.note,
			time: t,
			build: n.build
		}));

		songDuration = timeline.length ? timeline[timeline.length - 1].time : 0;

		scheduledIndex = 0;
	}
}

let playNote, ensureAudioLoaded, audioCtx;
function playAudio() {
	if (window.getComputedStyle(bardNoteContainer).display == "none") return;

	return (async () => {

        ({ playNote, ensureAudioLoaded, audioCtx } = await import("../audioPlayer.js"));

		await audioCtx.resume();

		const seen = new Set();
		const uniqueNotes = rawBardNotes
			.filter(item => {
				if (seen.has(item.note)) return false;
				seen.add(item.note);
				return true;
			})
			.map(item => item.build);

		await ensureAudioLoaded(uniqueNotes);
		ensureTimeline();

		if (!isPlaying) {
			isPlaying = true;
			startCtxTime = audioCtx.currentTime - pauseTime;

			if (schedulerTimer) return;
			schedulerTimer = setInterval(() => {
				scheduler();
			}, 25);
		}
	})();
}

function pauseAudio() {
	if (!isPlaying) return;

	isPlaying = false;
	pauseTime = audioCtx.currentTime - startCtxTime;

	if (schedulerTimer) {
		clearInterval(schedulerTimer);
		schedulerTimer = null;
	}
}


const playbackBtn = document.getElementById('playbackBtn');
function handlePlayToggle() {
	if (timeline.length > 0 && scheduledIndex === timeline.length) {
		pauseTime = 0;
		scheduledIndex = 0;
		startCtxTime = audioCtx.currentTime;
		lastIndex = -1;
		setTrackPercent(0);
		noteLabel.textContent = "0";
		updateNoteHighlights();

		return;
	}

    playbackBtn.classList.toggle("playing");

	if (isPlaying) {
		pauseAudio();
	} else {
		playAudio();
	}
}

overlay.addEventListener("keydown", (e) => {
	if (e.code === "Space") {
		e.preventDefault();
        handlePlayToggle();
	}
});

playbackBtn.addEventListener("click", (e) => {
    handlePlayToggle();
});


track.addEventListener("pointerdown", async (e) => {
	isDragging = true;
	ensureTimeline();
	headSeek(getPercentFromEvent(e));
});

window.addEventListener("pointermove", (e) => {
	if (!isDragging) return;
	headSeek(getPercentFromEvent(e));
});

window.addEventListener("pointerup", () => {
	isDragging = false;
});

document.addEventListener("click", (e) => {
	const noteEl = e.target.closest(".note");
	if (!noteEl) return;

	ensureTimeline();

	const index = parseInt(noteEl.dataset.index, 10);
	if (isNaN(index)) return;

	seekToNote(index);
});


/* Length / threshold modifying */

function generateNotesLayout(inputThreshold, inputMaxLength) {
	const { notes, delays, threshold, maxLength } = groupNotes(rawBardNotes, {
		threshold: parseFloat(inputThreshold),
		maxLength: parseInt(inputMaxLength)
	});


	converterEles.maxLength.value = maxLength;
	converterEles.threshold.value = threshold;

	renderNotes(notes, delays);
}

trackControlEles.maxLength.addEventListener("input", () => {
	converterEles.maxLength.value = trackControlEles.maxLength.value
	generateNotesLayout(trackControlEles.threshold.value, trackControlEles.maxLength.value);
});

trackControlEles.threshold.addEventListener("input", () => {
	converterEles.threshold.value = trackControlEles.threshold.value
	generateNotesLayout(trackControlEles.threshold.value, trackControlEles.maxLength.value);
});


// Font range

const fontRangeEle = document.getElementById('fontRange');
const savedFontSize = localStorage.getItem("noteFontSize");
if (savedFontSize !== null) {
	fontRangeEle.value = savedFontSize;
    setNoteSize(false);
}

function setNoteSize(save = true) {
	if (fontRangeEle.value == 0) {
		bardNoteContainer.style.fontSize = "";
	} else {
		bardNoteContainer.style.fontSize = fontRangeEle.value + "px";
	}

    if (save) {
        localStorage.setItem("noteFontSize", fontRangeEle.value);
    }
}

fontRangeEle.addEventListener("input", setNoteSize);