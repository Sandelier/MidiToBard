const converterEle = document.getElementById('converter');
const thresholdEle = converterEle.querySelector('.threshold');
const maxLengthEle = converterEle.querySelector('.maxLength');
const formatEle = document.getElementById('formatSelect');


formatEle.value = localStorage.getItem("downloadFormat") ?? formatEle.value;
formatEle.addEventListener("change", () => {
	localStorage.setItem("downloadFormat", formatEle.value);
});



export async function main() {
    const { groupNotes, rawBardNotes } = await import("./noteProcessor.js");

    const { notes, delays } = groupNotes(rawBardNotes, {
        threshold: parseFloat(thresholdEle.value),
        maxLength: parseInt(maxLengthEle.value)
    });

    const format = formatEle.value;
    let blob;

    if (format == "xlsx") {
        blob = await buildExcel(notes, delays);
    } else if (format == "txt") {
        blob = new Blob([notes], { type: "text/plain" });
    } else if (format == "json") {
        const noBuild = rawBardNotes.map(({ build, ...rest }) => rest);
        const bardJson = JSON.stringify(noBuild, null, 4);
        blob = new Blob([bardJson], { type: "application/json" });
    } else {
        console.error("Unknown download format");
        return;
    }

    const name = converterEle.querySelector('.name').value || "Notes";
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.${format}`;
    link.click();

    URL.revokeObjectURL(link.href);
};

// Excel

let excelJsPromise = null;

function loadExcelJS() {
	if (excelJsPromise) return excelJsPromise;

	excelJsPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = "libs/exceljs-min-4.4.0.js";
		script.onload = () => resolve();
		script.onerror = reject;
		document.head.appendChild(script);
	});

	return excelJsPromise;
}


async function buildExcel(notes, delays) {
    await loadExcelJS();

	const workbook = new ExcelJS.Workbook();
	const sheet = workbook.addWorksheet("Notes");

	const rows = notes
		.split("\n")
		.map(r => r.trim())
		.filter(r => r.length > 0);

	let rowIndex = 1;
    let cellIndex = 0;
	rows.forEach(line => {
		const row = sheet.getRow(rowIndex);
		const cols = line.split("\t");

		cols.forEach((note, colIndex) => {
            const cell = row.getCell(colIndex + 1);
            cell.alignment = { wrapText: true };

            const delay = delays[cellIndex];
            const needsRichText = note.includes("[") || note.includes("]");

            const baseColor = "FFE8E6E3";

            const getDelayColor = () => {
                if (cellIndex > 0 && delay <= 0.1) return "FFFF8E8E";
                if (cellIndex > 0 && delay <= 0.2) return "FFFFEE8C";
                if (cellIndex > 0 && delay >= 1) return "FFFF8CF2";
                return baseColor;
            };
        
            const mainColor = getDelayColor();
            const bracketColor = "FF00D9FF";
        
            if (!needsRichText) {
                cell.value = note;
                cell.font = {
                    color: { argb: mainColor }
                };
            } else {
                const richText = [];

                for (let i = 0; i < note.length; i++) {
                    const char = note[i];

                    const isBracket = char === "[" || char === "]";

                    richText.push({
                        text: char,
                        font: {
                            color: {
                                argb: isBracket ? bracketColor : mainColor
                            }
                        }
                    });
                }

                cell.value = { richText };
            }

            cellIndex++;
        });

		row.commit();
		rowIndex++;
	});

	const buffer = await workbook.xlsx.writeBuffer();

	return new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
}