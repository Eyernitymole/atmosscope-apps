// AtmosScope V1.6 compatibility patch
// Additional interfaces for professional atlas products.

export function addMoistureVectors(qu = [], qv = []) {
    const out = [];
    for (let r = 0; r < qu.length; r += 2) {
        for (let c = 0; c < qu[r].length; c += 2) {
            const u = Number(qu[r][c]);
            const v = Number(qv?.[r]?.[c]);
            if (Number.isFinite(u) && Number.isFinite(v)) {
                out.push({
                    r,
                    c,
                    u,
                    v,
                    magnitude: Math.hypot(u, v),
                    className: 'moisture-vector-arrow'
                });
            }
        }
    }
    return out;
}

export function trailingPrecipitation(hourly = {}, index = 0) {
    const p = hourly?.precipitation;
    if (!Array.isArray(p)) return 0;
    return p.slice(index, index + 24)
        .reduce((a, b) => a + (Number(b) || 0), 0);
}

export function addHeightContours(field) {
    return {
        type: 'height-contours',
        field,
        derived: true
    };
}

export async function consultationComposite(fields = {}) {
    return {
        height: addHeightContours(fields.geopotential_height_500hPa),
        moisture: fields.moistureFlux850,
        precipitation: fields.precipitation,
        note: 'derived consultation composite'
    };
}
