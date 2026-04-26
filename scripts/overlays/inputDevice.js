
export function createDevice(deviceName, deviceMap) {

    const mapping = deviceMap[deviceName];

	const device = document.createElement('div');
	device.classList.add('device');

	const deviceTitle = document.createElement('h3');
	deviceTitle.textContent = deviceName;
	device.appendChild(deviceTitle);

	const controlsSection = document.createElement('div');
	controlsSection.classList.add('device-section');

	const modifiers = [
        { key: 'octUp', label: 'Octave up' },
        { key: 'octDown', label: 'Octave down' },
        { key: 'flat', label: 'Flat' },
        { key: 'sharp', label: 'Sharp' }
    ];

	modifiers.forEach(({ key, label }) => {
    	const row = document.createElement('div');
    	row.classList.add('device-row');

    	const inputId = `${deviceName}-${key}`;

    	const labelEl = document.createElement('label');
    	labelEl.textContent = label;
    	labelEl.htmlFor = inputId;

    	const input = document.createElement('input');
    	input.type = 'text';
    	input.id = inputId;
    	input.value = mapping[key] || "";

    	input.addEventListener('input', () => {
    		const noBrackets = input.value.replace(/[\[\]]/g, '');
            mapping[key] = noBrackets;
            input.value = noBrackets;
    		localStorage.setItem("deviceMapping", JSON.stringify(deviceMap));
    	});

    	row.appendChild(labelEl);
    	row.appendChild(input);
    	controlsSection.appendChild(row);
    });

	device.appendChild(controlsSection);

	const pitchSection = document.createElement('div');
	pitchSection.classList.add('device-section');

	Object.keys(mapping.pitches).forEach(note => {
    	const row = document.createElement('div');
    	row.classList.add('device-row');

    	const inputId = `${deviceName}-pitch-${note}`;

    	const label = document.createElement('label');
    	label.textContent = note;
    	label.htmlFor = inputId;

    	const input = document.createElement('input');
    	input.type = 'text';
    	input.id = inputId;
    	input.value = mapping.pitches[note] || "";

    	input.addEventListener('input', () => {
            const noBrackets = input.value.replace(/[\[\]]/g, '');
            mapping.pitches[note] = noBrackets;
            input.value = noBrackets;
    		localStorage.setItem("deviceMapping", JSON.stringify(deviceMap));
    	});
        
    	row.appendChild(label);
    	row.appendChild(input);
    	pitchSection.appendChild(row);
    });

	device.appendChild(pitchSection);

	document.getElementById('deviceLayout').appendChild(device);
}