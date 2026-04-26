const editor = document.getElementById("noteEditor");
const overrideList = document.getElementById("overrideList");

let deviceMappings = null;
export async function main() {
    (await import("./overlayController.js")).showOverlay();
    deviceMappings = (await import("../noteMapper.js")).setDeviceMapping();

	document.getElementById('noteOverridePanel').style.display = "flex";

	loadFromStorage();
}

// Override Row
function createSelect(optionsMap, selectedValue = "", textContent = "-") {
	const select = document.createElement("select");

	if (textContent) {
		const none = document.createElement("option");
		none.value = "";
		none.textContent = textContent;
		select.appendChild(none);
	}

	Object.entries(optionsMap).forEach(([value, label]) => {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = label;
		if (value === selectedValue) option.selected = true;
		select.appendChild(option);
	});

	return select;
}

function createNoteRow(noteKey = "B5", value = []) {
	const row = document.createElement("div");
	row.className = "override-row";

	const noteInput = document.createElement("input");
	noteInput.value = noteKey;

	const octave = value.find(v => v === "octDown" || v === "octUp") || "";
	const accidental = value.find(v => v === "sharp" || v === "flat") || "";
	const mid = value[value.length - 1] || "";

	const octSelect = createSelect({
		octDown: deviceMappings.octDown,
		octUp: deviceMappings.octUp
	}, octave);

	const accSelect = createSelect({
		sharp: deviceMappings.sharp,
		flat: deviceMappings.flat
	}, accidental);

	const pitchSelect = createSelect(deviceMappings.pitches, mid, "");

	const delBtn = document.createElement("button");
	delBtn.textContent = "✕";
	delBtn.onclick = () => {
		row.remove();
		saveToStorage();
	};


	noteInput.addEventListener("input", (e) => {
		e.target.value = e.target.value.toUpperCase();
		saveToStorage();
	});

	[octSelect, accSelect, pitchSelect].forEach(el => {
		el.addEventListener("change", saveToStorage);
	});

	row.append(noteInput, octSelect, accSelect, pitchSelect, delBtn);
	overrideList.appendChild(row);
}

// Storage

document.getElementById("addOverrideBtn").addEventListener("click", () => {
	createNoteRow();
	saveToStorage();
});

function saveToStorage() {
	const overrides = {};

	document.querySelectorAll(".override-row").forEach(row => {
		const inputs = row.querySelectorAll("input, select");

		const noteKey = inputs[0].value.trim();
		const oct = inputs[1].value;
		const acc = inputs[2].value;
		const mid = inputs[3].value;

		if (!isValidNote(noteKey)) {
			inputs[0].classList.add("error");
			return;
		} else {
			inputs[0].classList.remove("error");
		}

		if (!mid) {
			inputs[3].classList.add("error");
			return;
		} else {
			inputs[3].classList.remove("error");
		}


		const arr = [];

		if (oct) arr.push(oct);
		if (acc) arr.push(acc);

		arr.push(mid);

		overrides[noteKey] = arr;
	});

	localStorage.setItem("noteOverride", JSON.stringify(overrides));
}

function isValidNote(note) {
	const regex = /^[A-G](#|b)?[0-9]$/;

	if (!regex.test(note)) return false;

	const octave = parseInt(note.slice(-1), 10);

	if (octave < 0 || octave > 9) return false;

	if (octave === 0 && !['C', 'D', 'E', 'F', 'G', 'A', 'B'].includes(note[0])) {
		return false;
	}

	return true;
}


function loadFromStorage() {
	let noteOverride = {};

	try {
		noteOverride = JSON.parse(localStorage.getItem("noteOverride")) || {};
	} catch {
		noteOverride = {};
	}

	overrideList.innerHTML = "";

	for (const [note, value] of Object.entries(noteOverride)) {
		const args = (value || []).filter(v => v !== undefined);

		createNoteRow(note, args);
	}
}