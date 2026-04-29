const songListEle = document.getElementById("songList");
const songPanel = document.getElementById("songPanel");

let songsAdded = false;

export async function main() {
	(await import("./overlays/overlayController.js")).showOverlay();
	songPanel.style.display = "block";

	if (songsAdded) return;

	const response = await fetch("./songs/songStatistics.json");
	let songStatistics = await response.json();

	songStatistics = Object.fromEntries(
		Object.entries(songStatistics).sort((a, b) => {
			const genreA = a[1].genre.toLowerCase();
			const genreB = b[1].genre.toLowerCase();
			return genreA.localeCompare(genreB);
		})
	);

	addSongs(songStatistics);
}

// Song structure to DOM
let currentPlaybackBtn = null;
let currentSongEle = null;

function addSongs(songStatistics) {
	const fragment = document.createDocumentFragment();
	const genresMap = new Map();

	Object.entries(songStatistics).forEach(([filePath, data], index) => {

		const genreKey = data.genre;
		genresMap.set(
			genreKey,
			(genresMap.get(genreKey) || 0) + 1
		);

		const songName = filePath
			.replace("list\\", "")
			.replace(".json", "");

		const songPath = "../songs/" + filePath;

		const songEle = createDiv("", "song");
		songEle.dataset.filePath = songPath;

		// Info
		const info = createDiv("", "songInfo");

		const titleContainer = createDiv("", "songTitleContainer");
		const title = createDiv(songName, "songTitle");
		const indexEle = createDiv(`#${index + 1}`, "songIndex");
		titleContainer.append(title, indexEle);

		const artist = createDiv(data.artist, "songArtist");

		info.append(titleContainer, artist);

		// Meta
		const meta = createDiv("", "songMeta");

		const genre = createDiv(data.genre, "songGenre");
		const duration = createDiv(
			`${(data.duration / 1000).toFixed(1)}s`,
			"songDuration"
		);
		const notes = createDiv(`${data.notes} notes`, "songNotes");

		meta.append(genre, duration, notes);

		// Controls
		const controls = createDiv("", "songControls");

		const playbackBtn = createButton("", async () => {
			const songNotes = await loadSong(songPath);
			
			if (songPath !== currentSongPath) {
				currentSongPath = songPath;
			
				pauseSong();
				timeline = [];
				pauseTime = 0;
				scheduledIndex = 0;
			
				if (currentPlaybackBtn && currentPlaybackBtn !== playbackBtn) {
					currentPlaybackBtn.classList.remove("playing");
				}
			
				if (currentSongEle && currentSongEle !== songEle) {
					currentSongEle.style.backgroundColor = "";
				}
			
				await playSong(songNotes);
			
				playbackBtn.classList.add("playing");
				currentPlaybackBtn = playbackBtn;
			
				songEle.style.backgroundColor = "#2a2a2a";
				currentSongEle = songEle;
			
				return;
			}
		
			if (isPlaying) {
				pauseSong();
				currentPlaybackBtn = null;
			} else {
				await playSong(songNotes);
				playbackBtn.classList.add("playing");
				currentPlaybackBtn = playbackBtn;
			
				songEle.style.backgroundColor = "#2a2a2a";
				currentSongEle = songEle;
			}
		});

		playbackBtn.setAttribute("aria-label", `Playback ${songName}`);

		playbackBtn.classList.add("playbackBtn");
		playbackBtn.innerHTML = `
			<svg class="songPlaybackSvg play" viewBox="0 0 12 24">
				<polygon points="0,5 12,12 0,19"></polygon>
			</svg>
			<svg class="songPlaybackSvg pause" viewBox="0 0 12 24">
				<rect x="1" y="5" width="4" height="14"></rect>
				<rect x="7" y="5" width="4" height="14"></rect>
			</svg>
		`;

		const addBtn = createButton("+", async () => {
			const songNotes = await loadSong(songPath);

			(await import("./noteProcessor.js")).directProcess(
				songNotes,
				rawSongData,
				songName
			);

			document.getElementById("closeOverlay").click();
		});

		controls.append(playbackBtn, addBtn);

		songEle.append(info, meta, controls);
		fragment.appendChild(songEle);
	});

	songListEle.appendChild(fragment);
	songsAdded = true;

	// Genre btns

	const sortedGenres = [...genresMap.entries()]
		.sort((a, b) => b[1] - a[1]);

	const genreContainer = document.getElementById("genreButtons");

	const allBtn = createButton("All", () => {
		searchInput.value = "";
		searchInput.dispatchEvent(new Event("input"));
	});
	genreContainer.appendChild(allBtn);
	sortedGenres.forEach(([genre]) => {
		const btn = createButton(genre, () => {
			searchInput.value = genre;
			searchInput.dispatchEvent(new Event("input"));
		});

		genreContainer.appendChild(btn);
	});

	allGenres = sortedGenres.map(g => g[0].toLowerCase());
}

function createDiv(text, className) {
	const div = document.createElement("div");
	div.textContent = text;

	if (className) div.className = className;

	return div;
}

function createButton(text, onClick) {
	const btn = document.createElement("button");
	btn.textContent = text;

    // Fixes the scroll-tap cancellation issues on mobile
	btn.addEventListener("pointerup", (e) => {
		e.stopPropagation();
		onClick(e);
	});

	return btn;
}

// Search

const searchInput = document.getElementById("songSearch");
let allGenres = null;

searchInput.addEventListener("input", () => {
	const query = searchInput.value.toLowerCase();
	const songs = document.querySelectorAll("#songList .song");

	const isGenre = allGenres.includes(query);

	songs.forEach(song => {
		const title = song.querySelector(".songTitle").textContent.toLowerCase();
		const artist = song.querySelector(".songArtist").textContent.toLowerCase();
		const genre = song.querySelector(".songGenre").textContent.toLowerCase();

		if (isGenre) {
			song.style.display = genre === query ? "" : "none";
			return;
		}

		if (title.includes(query) || artist.includes(query)) {
			song.style.display = "";
		} else {
			song.style.display = "none";
		}
	});
});

// Load song
const songCache = new Map();
const rawSongCache = new Map();
let convertToBard;
let rawSongData;

async function loadSong(songPath) {
	let songNotes;

	({ convertToBard } = await import("./noteMapper.js"));

	if (songCache.has(songPath)) {
		songNotes = songCache.get(songPath);
		rawSongData = rawSongCache.get(songPath);
	} else {
		const res = await fetch(songPath);
		rawSongData = await res.json();

		songNotes = convertToBard(rawSongData, null, false);

		songCache.set(songPath, songNotes);
		rawSongCache.set(songPath, rawSongData);
	}

	return songNotes;
}

// Play song logic
let timeline = [];
let isPlaying = false;
let startCtxTime = 0;
let pauseTime = 0;
let scheduledIndex = 0;
let schedulerTimer = null;

let playNote, ensureAudioLoaded, audioCtx;
let currentSongPath = null;

function ensureTimeline(songNotes) {
	if (timeline.length) return;

	let t = 0;

	timeline = songNotes.map((n) => {
		t += n.delay;
		return {
			time: t,
			build: n.build
		};
	});

	scheduledIndex = 0;
}

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

	if (scheduledIndex >= timeline.length) {
		pauseSong();
	}
}

async function playSong(songNotes) {
	if (window.getComputedStyle(songPanel).display === "none") return;

	({ playNote, ensureAudioLoaded } = await import("./audioPlayer.js"));

	const seen = new Set();

	const uniqueNotes = songNotes
		.filter((item) => {
			if (seen.has(item.note)) return false;
			seen.add(item.note);
			return true;
		})
		.map((item) => item.build);

	audioCtx = await ensureAudioLoaded(uniqueNotes);
	await audioCtx.resume();

	ensureTimeline(songNotes);

	if (!isPlaying) {
		isPlaying = true;
		startCtxTime = audioCtx.currentTime - pauseTime;
		schedulerTimer = setInterval(scheduler, 25);
	}
}

export function pauseSong() {
	if (!isPlaying) return;

	isPlaying = false;
	pauseTime = audioCtx.currentTime - startCtxTime;

	currentPlaybackBtn?.classList.remove("playing");

	if (currentSongEle) {
		currentSongEle.style.backgroundColor = "";
		currentSongEle = null;
	}

	if (schedulerTimer) {
		clearInterval(schedulerTimer);
		schedulerTimer = null;
	}
}

// Close overlay
function resetSong() {
	isPlaying = false;
	startCtxTime = 0;
	pauseTime = 0;
	scheduledIndex = 0;
	timeline = [];

	if (currentPlaybackBtn) {
		currentPlaybackBtn.classList.remove("playing");
	}

	if (currentSongEle) {
		currentSongEle.style.backgroundColor = "";
		currentSongEle = null;
	}
}

document.getElementById("closeOverlay").addEventListener("click", resetSong);

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && overlay.style.display !== "none") {
		resetSong();
	}
});