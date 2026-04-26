export let onlineSequencerNotes = null;
const parserSettingsEle = document.getElementById('parserSettings');

document.getElementById('onlineSequencerInput').addEventListener("input", (e) => {
	const input = e.target.value;
	if (!input.startsWith('Online Sequencer:')) {
		e.target.value = "";
		parserSettingsEle.style.display = "none"
		return;
	};

	const noteRegex = /([\d.]+)\s+([A-G]#?\d)/g;
	const matches = [...input.matchAll(noteRegex)];

	if (matches.length === 0) {
		e.target.value = "";
		parserSettingsEle.style.display = "none"
		return;
	}

	// Online sequencer does not give notes in sequential way instead everything is just based on delays to know when to play.
	// First note is the relative point for all the delays
	onlineSequencerNotes = matches.map(match => ({
		note: match[2],
		delay: parseFloat(match[1])
	}));

	onlineSequencerNotes.sort((a, b) => a.delay - b.delay);

	parserSettingsEle.style.display = "flex"
	parserSettingsEle.querySelector('.notes').textContent = onlineSequencerNotes.length;
});