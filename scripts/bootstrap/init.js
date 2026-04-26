let deviceMapping = localStorage.getItem("deviceMapping");
if (!deviceMapping) {
    deviceMapping = {
        Keyboard: {
            octUp: ">",
            octDown: "<",
            flat: "▼",
            sharp: "▲",
            pitches: {
                C: "1",
                D: "2",
                E: "3",
                F: "4",
                G: "5",
                A: "6",
                B: "7",
                "C+": "8"
            }
        },
        Controller: {
            octUp: "R1",
            octDown: "R2",
            flat: "L2",
            sharp: "L1",
            pitches: {
                C: "A",
                D: "B",
                E: "Y",
                F: "X",
                G: "▲",
                A: ">",
                B: "▼",
                "C+": "<"
            }
        }
    };
    localStorage.setItem("deviceMapping", JSON.stringify(deviceMapping));
}