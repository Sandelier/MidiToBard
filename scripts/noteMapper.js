function noteToBardNote(realNote, noteOverrides = null) {
	const deviceMappings = setDeviceMapping();
	const { octUp, octDown, sharp, flat, pitches } = deviceMappings;

	if (noteOverrides && noteOverrides[realNote]) {
		const override = noteOverrides[realNote];

		const hasOctUp = override.includes("octUp");
		const hasOctDown = override.includes("octDown");
		const hasSharp = override.includes("sharp");
		const hasFlat = override.includes("flat");

		const pitch = override[override.length - 1];
		let modifiers = "";

		for (const m of override) {
			if (m === "octUp") modifiers += octUp;
			else if (m === "octDown") modifiers += octDown;
			else if (m === "sharp") modifiers += sharp;
			else if (m === "flat") modifiers += flat;
		}

		return {
			note: modifiers + pitches[pitch],
			build: override
		};
	}


	const realPitch = realNote[0];
	const realOctave = parseInt(realNote.match(/\d+/)?.[0], 10);


	let bardPitch = pitches[realPitch];

	if (realPitch === 'C' && realOctave > 4) {
		bardPitch = pitches["C+"];
	}

	const build = [];

	let bardModifiers = '';

	if (realOctave <= 3) {
		bardModifiers += octDown;
		build.push("octDown");
	} else if (realOctave >= 5) {
		bardModifiers += octUp;
		build.push("octUp");
	}

	if (realNote.includes('#')) {
		bardModifiers += sharp;
		build.push("sharp");
	}

	build.push(realPitch);

	return {
		note: bardModifiers + bardPitch,
		build
	};
}

export function setDeviceMapping() {
	const selectedDevice = document.querySelector('#converterSettings .device').value;
	const deviceMappings = (JSON.parse(localStorage.getItem("deviceMapping"))[selectedDevice]);
	return deviceMappings;
}

function getNoteValue(note) {
	const order = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
	const pitch = note[0];
	const isSharp = note.includes('#');
	const octave = parseInt(note.slice(-1), 10);

	let value = octave * 12 + order[pitch];
	if (isSharp) value += 1;

	return value;
}

export function groupByDelay(input) {
	const map = new Map();

	for (const { note, delay } of input) {
		const key = Number(delay.toFixed(6));

		if (!map.has(key)) map.set(key, []);
		const group = map.get(key);

		if (!group.includes(note)) group.push(note);
	}

	return map;
}

export function getHighestNote(notes) {
	let highest = notes[0];

	for (const n of notes) {
		if (getNoteValue(n) > getNoteValue(highest)) {
			highest = n;
		}
	}

	return highest;
}

const bpmEle = document.querySelector('#parserSettings .bpm');
export function convertToBard(input, midiBpm = null) {
	if (!Array.isArray(input)) {
		throw new Error("Input must be an array");
	}

	setDeviceMapping()
	const noteOverrides = JSON.parse(localStorage.getItem("noteOverride"));

	const result = [];
	let globalMin = null;
	let globalMax = null;

	if (midiBpm != null) {
		const map = groupByDelay(input);
		const sortedTimes = [...map.keys()].sort((a, b) => a - b);

		let prevTime = null;

		if (bpmEle.value <= 0) bpmEle.value = 120;

		for (const delay of sortedTimes) {
			const notes = map.get(delay);
			const highestNote = getHighestNote(notes);

			const rawDelay = prevTime === null ? 0 : (delay - prevTime);

			const calcDelay = +(rawDelay * (midiBpm / bpmEle.value)).toFixed(4);

			const noteResult = noteToBardNote(highestNote, noteOverrides)

			result.push({
				note: noteResult.note,
				delay: calcDelay,
				build: noteResult.build
			});

			const value = getNoteValue(highestNote);

			if (globalMax === null || value > getNoteValue(globalMax)) {
				globalMax = highestNote;
			}

			if (globalMin === null || value < getNoteValue(globalMin)) {
				globalMin = highestNote;
			}

			prevTime = delay;
		}

		// Raw delays
	} else {
		let prevTime = null;

		for (const notes of input) {

			const noteResult = noteToBardNote(notes.note, noteOverrides)

			result.push({
				note: noteResult.note,
				delay: notes.delay,
				build: noteResult.build
			});

			const value = getNoteValue(notes.note);

			if (globalMax === null || value > getNoteValue(globalMax)) {
				globalMax = notes.note;
			}

			if (globalMin === null || value < getNoteValue(globalMin)) {
				globalMin = notes.note;
			}

			prevTime = notes.delay;
		}
	}

	return {
		notes: result,
		highestNote: globalMax,
		lowestNote: globalMin
	};
}