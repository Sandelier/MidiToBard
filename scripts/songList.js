window.process = {
  env: {
	NODE_ENV: "development"
  }
};

const songListEle = document.getElementById("songList");
const songPanel = document.getElementById("songPanel");

let songsAdded = false;
let isLoadingSong = false;

let songVirtualizer;
let songEntries = [];
let filteredSongEntries = [];

export async function main() {
	(await import("./overlays/overlayController.js")).showOverlay();
	songPanel.style.display = "block";

	if (songsAdded) return;

	const response = await fetch("./songs/songStatistics.json");
	const rawSongStatistics = await response.json();

	const songStatistics = {};
	const folderMapping = rawSongStatistics.folderMapping;

	const now = Date.now();
	const week = 1000 * 60 * 60 * 24 * 7;

	const sortedTimestamps = Object.keys(rawSongStatistics)
		.filter(key => key !== "folderMapping" && !isNaN(Number(key)))
		.map(Number)
		.sort((a, b) => b - a);

	for (const timestamp of sortedTimestamps) {
		const songs = rawSongStatistics[timestamp];
		const isNew = (now - timestamp) < week;

		for (const [songPath, songData] of Object.entries(songs)) {
			const parts = songPath.split("\\");
			const genre = parts[1];
			let source = parts[2];

			if (folderMapping[source]) {
				source = folderMapping[source];
			}

			songStatistics[songPath] = {
				...songData,
				newSong: isNew,
				addedAt: timestamp,
				genre,
				source
			};
		}
	}

	addSongs(songStatistics);
}

function addSongs(songStatistics,) {
	const genresMap = new Map();
	const playedSongs = JSON.parse(localStorage.getItem("playedSongs") || "{}");

	songEntries = Object.entries(songStatistics).map(([filePath, data], index) => {

		const genreKey = data.genre;
		genresMap.set(
			genreKey,
			(genresMap.get(genreKey) || 0) + 1
		);
		const songName = filePath
			.split("\\")
			.pop()
			.replace(".json", "");

		const songPath = "./songs/" + filePath;

		return {
			filePath,
			data,
			index,
			songName,
			songPath,
			played: !!playedSongs[songPath],
		};
	});
	filteredSongEntries = [...songEntries];

	initSongVirtualizer(genresMap);
}

function getGridRows() {
	const width = songPanel.clientWidth || 1200;
	const cols = Math.max(1, Math.floor(width / 340));
	const rows = [];

	for (let i = 0; i < filteredSongEntries.length; i += cols) {
		rows.push(filteredSongEntries.slice(i, i + cols));
	}

	return rows;
}

async function initSongVirtualizer(genresMap) {
	if (songsAdded) return;
	songsAdded = true;

	const { Virtualizer, observeElementRect, observeElementOffset, elementScroll } = await import("../libs/tanstack/virtual-core/index.js");

	songVirtualizer = new Virtualizer({
		count: getGridRows().length,
		getScrollElement: () => songPanel.parentElement,
		estimateSize: () => 117 + 10,
		overscan: 2,
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		onChange: renderVirtualSongs,
	});

	songVirtualizer._willUpdate();

	window.addEventListener("resize", () => {
		if (!songVirtualizer) return;

		const rowCount = getGridRows().length;

		songVirtualizer.setOptions({
			...songVirtualizer.options,
			count: rowCount,
		});

		songVirtualizer.measure();
		songVirtualizer._willUpdate();
	});

	setupUI(genresMap);
}

function renderVirtualSongs(instance) {
	const ul = songListEle;
	const rows = getGridRows();

	ul.innerHTML = "";
	ul.style.position = "relative";
	ul.style.height = `${instance.getTotalSize()}px`;

	instance.getVirtualItems().forEach((vRow) => {
		const rowSongs = rows[vRow.index];

		const row = document.createElement("div");

		row.style.position = "absolute";
		row.style.top = "0";
		row.style.left = "0";
		row.style.width = "100%";
		row.style.transform = `translateY(${vRow.start}px)`;

		row.style.display = "grid";
		row.style.gridTemplateColumns =
			"repeat(auto-fill, minmax(330px, 1fr))";
		row.style.gap = "10px";

		rowSongs.forEach((song) => {
			row.appendChild(createSongElement(song));
		});

		ul.appendChild(row);
	});
}

function createSongElement({ filePath, data, songName, songPath, index, played }) {
	const songEle = createDiv("", "song");
	songEle.dataset.songPath = songPath;
	songEle.dataset.songName = songName;

	// Info
	const info = createDiv("", "songInfo");

	const titleContainer = createDiv("", "songTitleContainer");
	const title = createDiv(songName, "songTitle");
	const indexEle = createDiv(`#${index + 1}`, "songIndex");

	titleContainer.append(title, indexEle);

	const source = createDiv(data.source, "songSource");
	info.append(titleContainer, source);

	// Meta
	const meta = createDiv("", "songMeta");

	const genre = createDiv(data.genre, "songGenre");
	const duration = createDiv(`${(data.duration / 1000).toFixed(1)}s`, "songDuration");
	const notes = createDiv(`${data.notes} notes`, "songNotes");

	meta.append(genre, duration, notes);

	if (data.newSong) {
		meta.append(createDiv("New", "songNew"));
	}

	// Controls
	const controls = createDiv("", "songControls");

	const playbackBtn = document.createElement("button");
	playbackBtn.className = "playbackBtn";

	if (played) playbackBtn.classList.add("playedSong");

	if (songPath === currentSongPath && isPlaying) playbackBtn.classList.add("playing");

	playbackBtn.setAttribute("aria-label", `Playback ${songName}`);

	playbackBtn.innerHTML = `
		<svg class="songPlaybackSvg play" viewBox="0 0 12 24">
			<polygon points="0,5 12,12 0,19"></polygon>
		</svg>
		<svg class="songPlaybackSvg pause" viewBox="0 0 12 24">
			<rect x="1" y="5" width="4" height="14"></rect>
			<rect x="7" y="5" width="4" height="14"></rect>
		</svg>
	`;

	const addBtn = document.createElement("button");
	addBtn.className = "addBtn";
	addBtn.textContent = "+";

	controls.append(playbackBtn, addBtn);

	songEle.append(info, meta, controls);

	return songEle;
}

songListEle.addEventListener("pointerup", async (e) => {
	const btn = e.target.closest("button");
	if (!btn) return;

	e.stopPropagation();

	const songEle = btn.closest(".song");
	if (!songEle) return;

	const songPath = songEle.dataset.songPath;
	const songName = songEle.dataset.songName;

	if (btn.classList.contains("playbackBtn")) {

		if (isLoadingSong) return;
		isLoadingSong = true;

		try {
			const songNotes = await loadSong(songPath);

			const playedSongs = JSON.parse(localStorage.getItem("playedSongs") || "{}");
			playedSongs[songPath] = true;
			localStorage.setItem("playedSongs", JSON.stringify(playedSongs));

			const songEntry = songEntries.find(song => song.songPath === songPath);

			if (songEntry) songEntry.played = true;

			btn.classList.add("playedSong");

			if (songPath !== currentSongPath) {
				currentSongPath = songPath;

				pauseSong();
				timeline = [];
				pauseTime = 0;
				scheduledIndex = 0;

				document.querySelectorAll(".playbackBtn.playing").forEach(playBtn => {
					playBtn.classList.remove("playing");
					playBtn.closest(".song").style.backgroundColor = "";
				});

				await playSong(songNotes);

				btn.classList.add("playing");
				songEle.style.backgroundColor = "#2a2a2a";
				return;
			}

			if (isPlaying) {
				pauseSong();
				document.querySelectorAll(".playbackBtn.playing").forEach(playBtn => {
					playBtn.classList.remove("playing");
					playBtn.closest(".song").style.backgroundColor = "";
				});
			} else {
				await playSong(songNotes);
				btn.classList.add("playing");
				songEle.style.backgroundColor = "#2a2a2a";
			}

		} finally {
			isLoadingSong = false;
		}

	} else if (btn.classList.contains("addBtn")) {

		const songNotes = await loadSong(songPath);

		(await import("./noteProcessor.js")).directProcess(
			songNotes,
			rawSongData,
			songName,
			{
				"genre": songEle.querySelector('.songGenre').textContent,
				"source": songEle.querySelector('.songSource').textContent
			}
		);

		document.getElementById("closeOverlay").click();
	}
});

function setupUI(genresMap) {

	const genresPanel = document.getElementById("genresPanel");
	const statusPanel = document.getElementById("statusPanel");

	// Filter tab toggle

	document.addEventListener("click", (e) => {
		const panelClick = [statusPanel, genresPanel].some(panel => panel.contains(e.target));
		if (!panelClick) {
			statusPanel.classList.remove("active");
			genresPanel.classList.remove("active");

			document.querySelectorAll(".filterTab").forEach(t => t.classList.remove("active"));
		}
	});


	const filterTabs = document.querySelectorAll(".filterTab");
	const filterPanels = document.querySelectorAll(".filterPanel");

	filterTabs.forEach(tab => {
		tab.addEventListener("click", (e) => {
			e.stopPropagation();
		
			const targetPanel = document.getElementById(tab.dataset.panel);
			const isActive = targetPanel.classList.contains("active");
		
			filterPanels.forEach(panel => panel.classList.remove("active"));
			filterTabs.forEach(t => t.classList.remove("active"));
		
			if (!isActive) {
				targetPanel.classList.add("active");
				tab.classList.add("active");
			}
		});
	});

	// Status Filter

	const statusButtons = statusPanel.querySelectorAll("button");

	statusButtons.forEach(btn => {
		btn.addEventListener("click", () => {

			const isActive = btn.classList.contains("active");
			statusButtons.forEach(btn => btn.classList.remove("active"));

			if (!isActive) {
				btn.classList.add("active");
				statusFilter = btn.textContent.toLowerCase();
			} else {
				statusFilter = null;
			}

			searchInput.dispatchEvent(new Event("input"));
		});
	});

	// Genre Filter

	const sortedGenres = [...genresMap.entries()]
		.sort((a, b) => b[1] - a[1]);


	const allBtn = createButton("All", () => {
		searchInput.value = "";
		searchInput.dispatchEvent(new Event("input"));
	});
	genresPanel.appendChild(allBtn);
	sortedGenres.forEach(([genre]) => {
		const btn = createButton(genre, () => {
			searchInput.value = genre;
			searchInput.dispatchEvent(new Event("input"));
		});

		genresPanel.appendChild(btn);
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
	let busy = false;

	// Fixes the scroll-tap cancellation issues on mobile
	btn.addEventListener("pointerup", async (e) => {
		e.stopPropagation();

		if (busy) return;
		busy = true;

		try {
			await onClick(e);
		} finally {
			busy = false;
		}
	});

	return btn;
}

// Search
const searchInput = document.getElementById("songSearch");
let allGenres = null;
let statusFilter = null;

function updateSongFilters() {
	const query = searchInput.value.toLowerCase().trim();

	const isGenre = allGenres.includes(query);

	filteredSongEntries = songEntries.filter((song) => {
		const title = song.songName?.toLowerCase();
		const source = song.data.source?.toLowerCase();
		const genre = song.data.genre?.toLowerCase();

		if (statusFilter) {

			if (statusFilter === "new" && !song.data.newSong) {
				return false;
			}

			if (statusFilter === "played" && !song.played) {
				return false;
			}

			if (statusFilter === "unplayed" && song.played) {
				return false;
			}
		}

		if (isGenre) {
			return genre === query;
		}

		return (
			title.includes(query) ||
			source && source.includes(query)
		);
	});

	songVirtualizer.setOptions({
		...songVirtualizer.options,
		count: getGridRows().length,
	});

	songVirtualizer.scrollToOffset(0);

	songVirtualizer.measure();
	songVirtualizer._willUpdate();
}

searchInput.addEventListener("input", updateSongFilters);

// Load song
const songCache = new Map();
const rawSongCache = new Map();
let convertToBard;
let rawSongData;
const loadingPromises = new Map();

async function loadSong(songPath) {
	let songNotes;

	({ convertToBard } = await import("./noteMapper.js"));

	if (songCache.has(songPath)) {
		return songCache.get(songPath);
	}

	if (loadingPromises.has(songPath)) {
		return loadingPromises.get(songPath);
	}

	const loadPromise = (async () => {
		try {
			const res = await fetch(songPath);
			rawSongData = await res.json();

			const songNotes = convertToBard(rawSongData, null, false);

			songCache.set(songPath, songNotes);
			rawSongCache.set(songPath, rawSongData);

			return songNotes;
		} finally {
			loadingPromises.delete(songPath);
		}
	})();

	loadingPromises.set(songPath, loadPromise);
	return loadPromise;
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
	if (!isPlaying || !audioCtx) return;

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
		pauseTime = 0;
		scheduledIndex = 0;
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

	if (!audioCtx || !audioCtx.resume) return;

	await audioCtx.resume();

	ensureTimeline(songNotes);

	if (!isPlaying) {
		isPlaying = true;
		startCtxTime = audioCtx.currentTime - pauseTime;
		schedulerTimer = setInterval(scheduler, 25);
	}
}

export function pauseSong() {
	if (!isPlaying || !audioCtx) return;

	isPlaying = false;
	pauseTime = audioCtx.currentTime - startCtxTime;

	document.querySelectorAll('.songControls .playbackBtn.playing').forEach(btn => {
		btn.classList.remove('playing');
		btn.closest('.song').style.backgroundColor = "";
	});

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

	document.querySelectorAll('.songControls .playbackBtn.playing').forEach(btn => {
		btn.classList.remove('playing');
		btn.closest('.song').style.backgroundColor = "";
	});
}

document.getElementById("closeOverlay").addEventListener("click", resetSong);

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && overlay.style.display !== "none") {
		resetSong();
	}
});