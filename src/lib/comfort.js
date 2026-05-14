/**
 * Frontend mirror du modele de confort. Permet d'afficher la calculation
 * en direct sans aller-retour API a chaque rendu. Doit rester identique a
 * src/lib/comfort.js du backend.
 */

export const COMFORT_CONFIG = {
  wall: {
    description: 'Mur en brique pleine non isolee de 30 cm',
    thickness_m: 0.30,
    conductivity_w_per_mk: 0.7,
    r_wall_m2k_per_w: 0.30 / 0.7,
    rsi_m2k_per_w: 0.13,
    rse_m2k_per_w: 0.04,
    get r_total_m2k_per_w() {
      return this.r_wall_m2k_per_w + this.rsi_m2k_per_w + this.rse_m2k_per_w;
    },
    get f_rsi() {
      return this.rsi_m2k_per_w / this.r_total_m2k_per_w;
    },
  },
  outdoor: {
    wind_safety_c: 2,
    description: 'On retire 2°C a la temperature exterieure pour modeliser le refroidissement par vent',
  },
  temperature: { min_c: 17, max_c: 26 },
  humidity: { min_pct: 30, max_pct: 60 },
  condensation: { mold_margin_c: 3 },
};

export function dewPointC(tempC, rhPct) {
  if (!Number.isFinite(tempC) || !Number.isFinite(rhPct) || rhPct <= 0) return NaN;
  const a = 17.27;
  const b = 237.7;
  const alpha = Math.log(rhPct / 100) + (a * tempC) / (b + tempC);
  return (b * alpha) / (a - alpha);
}

export function wallSurfaceTempC(tIntC, tExtC) {
  if (!Number.isFinite(tIntC) || !Number.isFinite(tExtC)) return NaN;
  return tIntC - (tIntC - tExtC) * COMFORT_CONFIG.wall.f_rsi;
}

export function adjustOutdoor(tExtRawC) {
  if (!Number.isFinite(tExtRawC)) return NaN;
  return tExtRawC - COMFORT_CONFIG.outdoor.wind_safety_c;
}

export function evaluateRoom({ tIntC, rhPct, tExtRawC }) {
  const tExtAdjC = adjustOutdoor(tExtRawC);
  const tSiC = wallSurfaceTempC(tIntC, tExtAdjC);
  const tDewC = dewPointC(tIntC, rhPct);
  const margin = Number.isFinite(tSiC) && Number.isFinite(tDewC) ? tSiC - tDewC : NaN;
  const moldMargin = COMFORT_CONFIG.condensation.mold_margin_c;

  const reasons = [];
  let status = 'ok';

  if (Number.isFinite(margin)) {
    if (margin <= 0) {
      status = 'condensation';
      reasons.push({ code: 'condensation', severity: 'bad', text: `Condensation sur le mur : surface ${tSiC.toFixed(1)}°C ≤ rosee ${tDewC.toFixed(1)}°C` });
    } else if (margin <= moldMargin) {
      status = 'mold_risk';
      reasons.push({ code: 'mold_risk', severity: 'bad', text: `Risque moisissure : paroi a ${margin.toFixed(1)}°C du point de rosee (marge mini ${moldMargin}°C)` });
    } else {
      reasons.push({ code: 'wall_ok', severity: 'good', text: `Paroi saine : surface ${tSiC.toFixed(1)}°C, rosee ${tDewC.toFixed(1)}°C (marge ${margin.toFixed(1)}°C)` });
    }
  }

  if (Number.isFinite(tIntC)) {
    if (tIntC < COMFORT_CONFIG.temperature.min_c) {
      if (status === 'ok') status = 'watch';
      reasons.push({ code: 'cold', severity: 'warn', text: `Trop froid : ${tIntC.toFixed(1)}°C (minimum ${COMFORT_CONFIG.temperature.min_c}°C)` });
    } else if (tIntC > COMFORT_CONFIG.temperature.max_c) {
      if (status === 'ok') status = 'watch';
      reasons.push({ code: 'hot', severity: 'warn', text: `Trop chaud : ${tIntC.toFixed(1)}°C (max ${COMFORT_CONFIG.temperature.max_c}°C)` });
    } else {
      reasons.push({ code: 'temp_ok', severity: 'good', text: `Temperature OK : ${tIntC.toFixed(1)}°C` });
    }
  }

  if (Number.isFinite(rhPct)) {
    if (rhPct < COMFORT_CONFIG.humidity.min_pct) {
      if (status === 'ok') status = 'watch';
      reasons.push({ code: 'dry', severity: 'warn', text: `Air sec : ${rhPct.toFixed(0)}% (min ${COMFORT_CONFIG.humidity.min_pct}%) — irrite les muqueuses` });
    } else if (rhPct > COMFORT_CONFIG.humidity.max_pct) {
      if (status === 'ok') status = 'watch';
      reasons.push({ code: 'humid', severity: 'warn', text: `Air humide : ${rhPct.toFixed(0)}% (max ${COMFORT_CONFIG.humidity.max_pct}%) — moisissures/acariens` });
    } else {
      reasons.push({ code: 'hum_ok', severity: 'good', text: `Humidite OK : ${rhPct.toFixed(0)}%` });
    }
  }

  return {
    inputs: { t_int_c: tIntC, rh_pct: rhPct, t_ext_raw_c: tExtRawC, t_ext_adj_c: tExtAdjC },
    derived: { t_si_c: tSiC, t_dew_c: tDewC, mold_margin_c: margin, f_rsi: COMFORT_CONFIG.wall.f_rsi },
    status,
    reasons,
  };
}

// Helpers UI
export const STATUS_COLOR = {
  ok: '#10b981',
  watch: '#f59e0b',
  mold_risk: '#ef4444',
  condensation: '#dc2626',
};

export const STATUS_LABEL = {
  ok: 'Confort OK',
  watch: 'A surveiller',
  mold_risk: 'Risque moisissure',
  condensation: 'Condensation',
};
