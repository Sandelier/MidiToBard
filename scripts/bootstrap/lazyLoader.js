


const actions = {
    noteOverrideBtn: () => import("../overlays/noteOverride.js"),
    previewBtn: () => import("../overlays/notePreview.js"),
    convertBtn: () => import("../noteProcessor.js"),
    downloadBtn: () => import("../noteDownloader.js"),
    songListBtn: () => import("../songList.js")
};

Object.entries(actions).forEach(([id, loader]) => {
    document.getElementById(id).addEventListener("click", async () => {
        (await loader()).main();
    });
});



document.getElementById('infoBtn').addEventListener("click", async () => {
	(await import("../overlays/overlayController.js")).showOverlay();
	document.getElementById('infoPanel').style.display = "block";
});


let devicesCreated = false;
document.getElementById('deviceLayoutBtn').addEventListener("click", async () => {

    if (devicesCreated == false) {
        const { createDevice } = await import("../overlays/inputDevice.js");
        const deviceMapping = JSON.parse(localStorage.getItem("deviceMapping"));
        createDevice("Keyboard", deviceMapping);
        createDevice("Controller", deviceMapping);
        devicesCreated = true;
    }
    
    (await import("../overlays/overlayController.js")).showOverlay();
	document.getElementById('deviceLayout').style.display = "block";
});