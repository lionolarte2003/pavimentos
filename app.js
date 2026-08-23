"use strict";

const SAMPLE_DATA = [
  { year: 2017, traffic: 4250 },
  { year: 2018, traffic: 4410 },
  { year: 2019, traffic: 4635 },
  { year: 2020, traffic: 4520 },
  { year: 2021, traffic: 4860 },
  { year: 2022, traffic: 5105 },
  { year: 2023, traffic: 5360 },
  { year: 2024, traffic: 5650 },
  { year: 2025, traffic: 5985 },
];

const COLORS = {
  observed: "#16162a",
  linear: "#1f1e8c",
  exponential: "#7a0e6f",
  poly2: "#5e5caa",
  poly3: "#a56620",
  selected: "#010176",
  success: "#347261",
  warning: "#a56620",
  danger: "#9d3347",
  stone: "#9595b3",
};

const state = {
  data: SAMPLE_DATA.map((row) => ({ ...row })),
  models: [],
  best: null,
  projection: [],
  growth: null,
  esal: [],
  esalTotal: 0,
  scenario: null,
  selectedModelKey: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const numberFormat = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", () => {
  bindNavigation();
  bindActions();
  bindHelpTooltips();
  renderDataTable();
  recalculate(false);
});

function bindNavigation() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => goTo(button.dataset.view));
  });
  $$('[data-go]').forEach((button) => {
    button.addEventListener("click", () => goTo(button.dataset.go));
  });
  $("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
}

function goTo(viewName) {
  const view = $(`#view-${viewName}`);
  if (!view) return;
  $$(".view").forEach((item) => item.classList.remove("active"));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  view.classList.add("active");
  $("#breadcrumb").textContent = view.dataset.title || "PavimEstudio";
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindActions() {
  $("#btnLoadExample").addEventListener("click", loadExample);
  $("#btnCalculate").addEventListener("click", () => recalculate(true));
  $("#btnAddRow").addEventListener("click", addRow);
  $("#btnExportCsv").addEventListener("click", exportProjectionCsv);
  $$(".btn-print").forEach((button) => button.addEventListener("click", printTechnicalReport));
  window.addEventListener("beforeprint", prepareTechnicalReport);
  window.addEventListener("afterprint", () => $("#printReport").setAttribute("aria-hidden", "true"));
  $("#csvInput").addEventListener("change", importCsv);
  $("#maxDegree").addEventListener("change", () => recalculate(false));
  $("#designYear").addEventListener("change", () => recalculate(false));

  ["heavyPct", "directionFactor", "laneFactor", "equivFactor"].forEach((id) => {
    $(`#${id}`).addEventListener("input", () => {
      updateRangeOutputs();
      updateEsal();
      renderDashboard();
    });
  });

  ["capacityInput", "demandChange", "diversion", "capacityChange"].forEach((id) => {
    $(`#${id}`).addEventListener("input", () => {
      updateRangeOutputs();
      updateScenario();
      renderScenario();
    });
  });
}

function bindHelpTooltips() {
  const tooltip = $("#helpTooltip");
  const show = (event) => {
    const target = event.currentTarget;
    tooltip.textContent = target.dataset.help;
    tooltip.classList.add("show");
    positionHelpTooltip(event, target, tooltip);
  };
  const hide = () => tooltip.classList.remove("show");
  $$('[data-help]').forEach((element) => {
    element.addEventListener("mouseenter", show);
    element.addEventListener("mousemove", (event) => positionHelpTooltip(event, element, tooltip));
    element.addEventListener("mouseleave", hide);
    element.addEventListener("focus", show);
    element.addEventListener("blur", hide);
  });
}

function positionHelpTooltip(event, target, tooltip) {
  const rect = target.getBoundingClientRect();
  const pointerX = Number.isFinite(event.clientX) && event.clientX > 0 ? event.clientX : rect.left + rect.width / 2;
  const pointerY = Number.isFinite(event.clientY) && event.clientY > 0 ? event.clientY : rect.top;
  const halfWidth = Math.min(155, (window.innerWidth - 24) / 2);
  tooltip.style.left = `${Math.max(halfWidth + 8, Math.min(pointerX, window.innerWidth - halfWidth - 8))}px`;
  tooltip.style.top = `${Math.max(90, pointerY)}px`;
}

function loadExample() {
  state.data = SAMPLE_DATA.map((row) => ({ ...row }));
  $("#designYear").value = 2045;
  $("#maxDegree").value = 3;
  renderDataTable();
  recalculate(false);
  showToast("Ejemplo institucional restaurado correctamente.");
}

function renderDataTable() {
  const body = $("#dataTable tbody");
  body.innerHTML = "";
  state.data.forEach((row, index) => {
    const previous = state.data[index - 1];
    const variation = previous && previous.traffic > 0
      ? `${(((row.traffic / previous.traffic) - 1) * 100).toFixed(2)}%`
      : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><input class="year-input" type="number" step="1" value="${row.year}" aria-label="Año fila ${index + 1}"></td>
      <td><input class="traffic-input" type="number" min="0" step="1" value="${row.traffic}" aria-label="Tráfico fila ${index + 1}"></td>
      <td>${variation}</td>
      <td><button class="remove-row" type="button" data-index="${index}" aria-label="Eliminar fila ${index + 1}">×</button></td>`;
    body.appendChild(tr);
  });
  $$(".remove-row", body).forEach((button) => {
    button.addEventListener("click", () => removeRow(Number(button.dataset.index)));
  });
  $("#dataCount").textContent = `${state.data.length} registros`;
}

function readTableData() {
  const rows = $$("#dataTable tbody tr");
  const data = rows.map((row) => ({
    year: Number($(".year-input", row).value),
    traffic: Number($(".traffic-input", row).value),
  }));
  return validateData(data);
}

function validateData(data) {
  if (data.length < 5) throw new Error("Se requieren al menos cinco observaciones históricas.");
  data.forEach((row) => {
    if (!Number.isInteger(row.year)) throw new Error("Todos los años deben ser enteros.");
    if (!Number.isFinite(row.traffic) || row.traffic < 0) throw new Error("El tráfico debe ser un número no negativo.");
  });
  const sorted = data.slice().sort((a, b) => a.year - b.year);
  const unique = new Set(sorted.map((row) => row.year));
  if (unique.size !== sorted.length) throw new Error("No pueden existir años duplicados.");
  if (new Set(sorted.map((row) => row.traffic)).size < 2) throw new Error("La serie necesita al menos dos valores de tráfico diferentes.");
  return sorted;
}

function addRow() {
  try { state.data = readTableData(); } catch { /* preserve current visible rows */ }
  const last = state.data[state.data.length - 1] || { year: new Date().getFullYear(), traffic: 0 };
  state.data.push({ year: last.year + 1, traffic: Math.round(last.traffic * 1.03) });
  renderDataTable();
}

function removeRow(index) {
  try { state.data = readTableData(); } catch { /* preserve the last valid state */ }
  if (state.data.length <= 5) {
    showToast("Debes conservar al menos cinco registros.", true);
    return;
  }
  state.data.splice(index, 1);
  renderDataTable();
  recalculate(false);
}

function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result).replace(/^\uFEFF/, "").trim();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const delimiter = lines[0].includes(";") ? ";" : ",";
      const parsed = lines.map((line) => line.split(delimiter).map((item) => item.trim().replace(/^"|"$/g, "")));
      if (!Number.isFinite(Number(parsed[0][0]))) parsed.shift();
      const data = parsed.map((cols) => ({
        year: Number(cols[0]),
        traffic: Number(String(cols[1] ?? "").replace(",", ".")),
      }));
      state.data = validateData(data);
      renderDataTable();
      recalculate(false);
      showToast("Archivo CSV importado correctamente.");
    } catch (error) {
      showToast(error.message || "No se pudo importar el archivo.", true);
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file, "UTF-8");
}

function recalculate(showSuccess = false) {
  try {
    state.data = readTableData();
    const lastYear = state.data[state.data.length - 1].year;
    const designInput = $("#designYear");
    designInput.min = String(lastYear + 1);
    if (Number(designInput.value) <= lastYear) designInput.value = String(lastYear + 20);
    const designYear = Number(designInput.value);
    const maxDegree = Number($("#maxDegree").value);

    state.models = fitAllModels(state.data, maxDegree);
    state.best = state.models.reduce((best, model) => model.metrics.cvRmse < best.metrics.cvRmse ? model : best);
    if (!state.models.some((model) => model.key === state.selectedModelKey)) state.selectedModelKey = state.best.key;
    state.growth = calculateGrowth(state.data);
    state.projection = makeProjection(state.data, state.best, designYear);
    updateRangeOutputs();
    updateEsal();
    updateScenario();

    renderDataTable();
    renderDashboard();
    renderModels();
    renderProjection();
    renderPavement();
    renderScenario();
    if (showSuccess) showToast("Análisis recalculado con los datos actuales.");
  } catch (error) {
    showToast(error.message || "No se pudo completar el análisis.", true);
  }
}

function fitAllModels(data, maxDegree) {
  const specs = [
    { key: "linear", name: "Lineal", type: "poly", degree: 1, color: COLORS.linear },
    { key: "exponential", name: "Exponencial", type: "exp", degree: 1, color: COLORS.exponential },
    { key: "poly2", name: "Polinomial grado 2", type: "poly", degree: 2, color: COLORS.poly2 },
  ];
  if (maxDegree >= 3 && data.length >= 5) {
    specs.push({ key: "poly3", name: "Polinomial grado 3", type: "poly", degree: 3, color: COLORS.poly3 });
  }
  return specs
    .filter((spec) => spec.type !== "exp" || data.every((row) => row.traffic > 0))
    .map((spec) => {
      const model = fitModel(spec, data);
      model.metrics = calculateMetrics(model, data);
      model.metrics.cvRmse = crossValidatedRmse(spec, data);
      return model;
    });
}

function fitModel(spec, data) {
  const baseYear = Math.min(...data.map((row) => row.year));
  const x = data.map((row) => row.year - baseYear);
  const y = data.map((row) => row.traffic);
  if (spec.type === "exp") {
    if (y.some((value) => value <= 0)) throw new Error("El modelo exponencial requiere valores mayores que cero.");
    const [intercept, slope] = polynomialCoefficients(x, y.map(Math.log), 1);
    const a = Math.exp(intercept);
    return {
      ...spec, baseYear, coefficients: [a, slope],
      predict: (year) => a * Math.exp(slope * (year - baseYear)),
      equation: `T(x) = ${formatEquationNumber(a)} · e^(${formatSigned(slope)}x), x = Año − ${baseYear}`,
    };
  }
  const coefficients = polynomialCoefficients(x, y, spec.degree);
  return {
    ...spec, baseYear, coefficients,
    predict: (year) => Math.max(0, coefficients.reduce((sum, coefficient, power) => sum + coefficient * ((year - baseYear) ** power), 0)),
    equation: polynomialEquation(coefficients, baseYear),
  };
}

function polynomialCoefficients(x, y, degree) {
  const size = degree + 1;
  const matrix = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => x.reduce((sum, value) => sum + value ** (row + column), 0))
  );
  const vector = Array.from({ length: size }, (_, power) =>
    x.reduce((sum, value, index) => sum + y[index] * value ** power, 0)
  );
  return solveLinearSystem(matrix, vector);
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) maxRow = row;
    }
    [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];
    const divisor = augmented[pivot][pivot];
    if (Math.abs(divisor) < 1e-12) throw new Error("El sistema de regresión es singular; revisa los años ingresados.");
    for (let column = pivot; column <= n; column += 1) augmented[pivot][column] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= n; column += 1) augmented[row][column] -= factor * augmented[pivot][column];
    }
  }
  return augmented.map((row) => row[n]);
}

function polynomialEquation(coefficients, baseYear) {
  let equation = `T(x) = ${formatEquationNumber(coefficients[0])}`;
  coefficients.slice(1).forEach((coefficient, index) => {
    const power = index + 1;
    equation += ` ${formatSigned(coefficient)}·${power === 1 ? "x" : `x^${power}`}`;
  });
  return `${equation}, x = Año − ${baseYear}`;
}

function calculateMetrics(model, data) {
  const observed = data.map((row) => row.traffic);
  const predicted = data.map((row) => model.predict(row.year));
  const mean = average(observed);
  const errors = observed.map((value, index) => value - predicted[index]);
  const ssResidual = errors.reduce((sum, value) => sum + value ** 2, 0);
  const ssTotal = observed.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const rmse = Math.sqrt(ssResidual / observed.length);
  const mapeValues = observed
    .map((value, index) => value === 0 ? null : Math.abs((value - predicted[index]) / value))
    .filter((value) => value !== null);
  return {
    r2: ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal,
    rmse,
    mape: average(mapeValues) * 100,
  };
}

function crossValidatedRmse(spec, data) {
  const errors = [];
  for (let index = 0; index < data.length; index += 1) {
    const training = data.filter((_, candidate) => candidate !== index);
    if (training.length < spec.degree + 1) return Number.POSITIVE_INFINITY;
    const model = fitModel(spec, training);
    errors.push(data[index].traffic - model.predict(data[index].year));
  }
  return Math.sqrt(average(errors.map((value) => value ** 2)));
}

function calculateGrowth(data) {
  const intervals = [];
  for (let index = 1; index < data.length; index += 1) {
    const previous = data[index - 1];
    const current = data[index];
    const years = current.year - previous.year;
    const rate = previous.traffic > 0 ? (current.traffic / previous.traffic) ** (1 / years) - 1 : 0;
    intervals.push({ from: previous.year, to: current.year, rate, weight: index });
  }
  const totalWeight = intervals.reduce((sum, item) => sum + item.weight, 0);
  const weighted = intervals.reduce((sum, item) => sum + item.rate * item.weight, 0) / totalWeight;
  const first = data[0];
  const last = data[data.length - 1];
  const cagr = first.traffic > 0 ? (last.traffic / first.traffic) ** (1 / (last.year - first.year)) - 1 : 0;
  return { intervals, weighted, factor: 1 + weighted, cagr };
}

function makeProjection(data, model, designYear) {
  const actualByYear = new Map(data.map((row) => [row.year, row.traffic]));
  const firstYear = data[0].year;
  const lastYear = data[data.length - 1].year;
  const rows = [];
  for (let year = firstYear; year <= designYear; year += 1) {
    const estimate = model.predict(year);
    const previous = rows[rows.length - 1];
    rows.push({
      year,
      observed: actualByYear.has(year) ? actualByYear.get(year) : null,
      estimated: estimate,
      stage: year <= lastYear ? "Histórico" : "Proyección",
      growth: previous && previous.estimated > 0 ? estimate / previous.estimated - 1 : null,
    });
  }
  return rows;
}

function updateRangeOutputs() {
  $("#heavyOut").textContent = $("#heavyPct").value;
  $("#directionOut").textContent = Number($("#directionFactor").value).toFixed(2);
  $("#laneOut").textContent = Number($("#laneFactor").value).toFixed(2);
  $("#equivOut").textContent = Number($("#equivFactor").value).toFixed(2);
  $("#demandOut").textContent = `${$("#demandChange").value}%`;
  $("#diversionOut").textContent = `${$("#diversion").value}%`;
  $("#capacityOut").textContent = `${$("#capacityChange").value}%`;
}

function updateEsal() {
  if (!state.best) return;
  const heavy = Number($("#heavyPct").value) / 100;
  const direction = Number($("#directionFactor").value);
  const lane = Number($("#laneFactor").value);
  const equivalent = Number($("#equivFactor").value);
  const lastYear = state.data[state.data.length - 1].year;
  const designYear = Number($("#designYear").value);
  state.esal = [];
  state.esalTotal = 0;
  for (let year = lastYear + 1; year <= designYear; year += 1) {
    const traffic = state.best.predict(year);
    const annual = traffic * 365 * heavy * direction * lane * equivalent;
    state.esalTotal += annual;
    state.esal.push({ year, annual, cumulative: state.esalTotal });
  }
  renderPavement();
}

function updateScenario() {
  if (!state.projection.length) return;
  const baseDemand = state.projection[state.projection.length - 1].estimated;
  const currentCapacity = Math.max(1, Number($("#capacityInput").value));
  const demandChange = Number($("#demandChange").value) / 100;
  const diversion = Number($("#diversion").value) / 100;
  const capacityChange = Number($("#capacityChange").value) / 100;
  const demand = baseDemand * (1 + demandChange) * (1 - diversion);
  const capacity = currentCapacity * (1 + capacityChange);
  const ratio = demand / capacity;
  state.scenario = { baseDemand, demand, capacity, ratio, ...classifyRatio(ratio) };
}

function classifyRatio(ratio) {
  if (ratio <= 0.60) return { label: "Fluida", color: COLORS.success, recommendation: "El corredor conserva una reserva operativa amplia. Mantén el monitoreo del crecimiento." };
  if (ratio <= 0.80) return { label: "Estable", color: COLORS.poly2, recommendation: "La operación es estable, aunque conviene verificar el comportamiento en hora punta." };
  if (ratio <= 0.90) return { label: "Cercana a capacidad", color: COLORS.warning, recommendation: "Existe poca reserva. Evalúa gestión de accesos y optimización de intersecciones." };
  if (ratio <= 1.00) return { label: "Saturada", color: COLORS.exponential, recommendation: "El corredor se aproxima al límite. Combina control de demanda y mejora de capacidad." };
  return { label: "Sobresaturada", color: COLORS.danger, recommendation: "La demanda supera la capacidad. Se requiere una intervención prioritaria y análisis detallado." };
}

function renderDashboard() {
  if (!state.best || !state.projection.length) return;
  const final = state.projection[state.projection.length - 1];
  const meanTraffic = average(state.data.map((row) => row.traffic));
  const relativeCv = state.best.metrics.cvRmse / meanTraffic;
  const confidence = relativeCv < 0.04 ? "Consistencia alta" : relativeCv < 0.08 ? "Consistencia moderada" : "Revisar incertidumbre";

  const validations = [
    { state: "validationDataState", text: "validationDataText", pass: state.data.length >= 5, detail: `${state.data.length} registros ordenados, positivos y sin años duplicados.` },
    { state: "validationStatState", text: "validationStatText", pass: state.best.metrics.r2 >= 0.75 && state.best.metrics.mape <= 15, detail: `R² ${state.best.metrics.r2.toFixed(4)} · MAPE ${state.best.metrics.mape.toFixed(2)}%.` },
    { state: "validationCrossState", text: "validationCrossText", pass: relativeCv <= 0.15, detail: `Error cruzado ${decimalFormat.format(state.best.metrics.cvRmse)} veh/día.` },
    { state: "validationRoadState", text: "validationRoadText", pass: final.estimated >= 0 && state.growth.weighted >= -0.05 && state.growth.weighted <= 0.15, detail: `Crecimiento ponderado ${formatPercent(state.growth.weighted)}.` },
  ];
  validations.forEach((item) => {
    const stateElement = $(`#${item.state}`);
    const textElement = $(`#${item.text}`);
    if (!stateElement || !textElement) return;
    stateElement.textContent = item.pass ? "Aprobado" : "Revisar";
    textElement.textContent = item.detail;
    stateElement.closest("article").classList.toggle("warning", !item.pass);
  });

  $("#kpiBestModel").textContent = state.best.name;
  $("#kpiBestReason").textContent = `Error de validación ${decimalFormat.format(state.best.metrics.cvRmse)} · ${confidence}`;
  $("#kpiDesignTraffic").textContent = numberFormat.format(final.estimated);
  $("#kpiDesignYear").textContent = `Año ${final.year}`;
  $("#kpiGrowth").textContent = formatPercent(state.growth.weighted);
  $("#kpiGrowthFactor").textContent = `Factor anual ${state.growth.factor.toFixed(4)}`;
  $("#kpiEsal").textContent = compactNumber(state.esalTotal);

  $("#decisionBadge").textContent = confidence;
  $("#decisionText").textContent = `${state.best.name} presenta el menor error de validación y proyecta ${numberFormat.format(final.estimated)} vehículos para ${final.year}.`;
  const trendText = state.growth.weighted >= 0
    ? `La serie reciente crece aproximadamente ${formatPercent(state.growth.weighted)} anual.`
    : `La serie reciente disminuye aproximadamente ${formatPercent(Math.abs(state.growth.weighted))} anual.`;
  $("#decisionList").innerHTML = `
    <div>${trendText}</div>
    <div>R² histórico: ${state.best.metrics.r2.toFixed(4)}.</div>
    <div>El ESAL es referencial y depende de los factores de vehículos pesados.</div>`;

  const firstYear = state.data[0].year;
  const designYear = final.year;
  const years = Array.from({ length: designYear - firstYear + 1 }, (_, index) => firstYear + index);
  const series = [
    { name: "Observado", color: COLORS.observed, width: 2.5, points: true, values: state.data.map((row) => ({ x: row.year, y: row.traffic })) },
    ...state.models.map((model) => ({
      name: model.name,
      color: model.color,
      width: model.key === state.best.key ? 3.4 : 1.6,
      dash: model.key === state.best.key ? "" : "7 6",
      values: years.map((year) => ({ x: year, y: model.predict(year) })),
    })),
  ];
  drawLineChart("dashboardChart", series, { lastObservedYear: state.data[state.data.length - 1].year });
  $("#mainLegend").innerHTML = series.map((item) => `<span><i style="background:${item.color}"></i>${item.name}</span>`).join("");
}

function renderModels() {
  if (!state.best) return;
  $("#metricsBody").innerHTML = state.models.map((model) => `
    <tr class="${model.key === state.best.key ? "winner" : ""}">
      <td><button class="table-model-button" type="button" data-model-key="${model.key}">${model.name}</button></td>
      <td>${model.metrics.r2.toFixed(6)}</td>
      <td>${decimalFormat.format(model.metrics.rmse)}</td>
      <td>${model.metrics.mape.toFixed(2)}%</td>
      <td>${decimalFormat.format(model.metrics.cvRmse)}</td>
      <td><span class="model-pill ${model.key === state.best.key ? "winner" : "candidate"}">${model.key === state.best.key ? "Recomendado" : "Candidato"}</span></td>
    </tr>`).join("");
  $("#modelSelector").innerHTML = state.models.map((model) => `
    <button class="model-choice ${model.key === state.selectedModelKey ? "active" : ""}" type="button" role="radio"
      aria-checked="${model.key === state.selectedModelKey}" data-model-key="${model.key}">
      <strong>${model.name}</strong>
      <small>Error de validación: ${decimalFormat.format(model.metrics.cvRmse)} veh/día</small>
      ${model.key === state.best.key ? '<span class="recommendation-mark">Recomendado</span>' : ""}
    </button>`).join("");
  $$('[data-model-key]').forEach((button) => button.addEventListener("click", () => selectModel(button.dataset.modelKey)));
  $("#equationGrid").innerHTML = state.models.map((model) => `
    <article class="equation-card ${model.key === state.best.key ? "best" : ""}">
      <h4>${model.name}</h4><code>${model.equation}</code>
      <span>${model.key === state.best.key ? "Seleccionado por menor error de validación" : `Error de validación: ${decimalFormat.format(model.metrics.cvRmse)} veh/día`}</span>
    </article>`).join("");
  drawBarChart("metricsChart", state.models.map((model) => ({ label: model.name.replace("Polinomial ", "P."), value: model.metrics.cvRmse, color: model.key === state.best.key ? COLORS.exponential : model.color })));
  renderModelVisualizations();
}

function selectModel(modelKey) {
  if (!state.models.some((model) => model.key === modelKey)) return;
  state.selectedModelKey = modelKey;
  $$(".model-choice").forEach((button) => {
    const isActive = button.dataset.modelKey === modelKey;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-checked", String(isActive));
  });
  renderModelVisualizations();
}

function renderModelVisualizations() {
  const selected = state.models.find((model) => model.key === state.selectedModelKey) || state.best;
  if (!selected) return;
  const firstYear = state.data[0].year;
  const lastObservedYear = state.data[state.data.length - 1].year;
  const designYear = Number($("#designYear").value);
  const years = Array.from({ length: designYear - firstYear + 1 }, (_, index) => firstYear + index);
  const observedSeries = { name: "Tráfico observado", color: COLORS.observed, width: 2.6, points: true, values: state.data.map((row) => ({ x: row.year, y: row.traffic })) };
  const selectedSeries = { name: selected.name, color: selected.color, width: 3.5, points: true, values: years.map((year) => ({ x: year, y: selected.predict(year) })) };

  $("#selectedModelSummary").innerHTML = `
    <div class="equation-summary"><span>Ecuación</span><strong>${selected.equation}</strong></div>
    <div><span>R²</span><strong>${selected.metrics.r2.toFixed(6)}</strong></div>
    <div><span>Error cuadrático</span><strong>${decimalFormat.format(selected.metrics.rmse)} veh/día</strong></div>
    <div><span>Error porcentual</span><strong>${selected.metrics.mape.toFixed(2)}%</strong></div>
    <div><span>Error de validación</span><strong>${decimalFormat.format(selected.metrics.cvRmse)} veh/día</strong></div>`;
  $("#selectedModelLegend").innerHTML = [observedSeries, selectedSeries].map((item) => `<span><i style="background:${item.color}"></i>${item.name}</span>`).join("");
  drawLineChart("selectedModelChart", [observedSeries, selectedSeries], { lastObservedYear });

  const allSeries = [
    observedSeries,
    ...state.models.map((model) => ({
      name: model.name,
      color: model.color,
      width: model.key === state.best.key ? 3.4 : 2,
      dash: model.key === state.best.key ? "" : "7 5",
      points: true,
      values: years.map((year) => ({ x: year, y: model.predict(year) })),
    })),
  ];
  $("#allModelsLegend").innerHTML = allSeries.map((item) => `<span><i style="background:${item.color}"></i>${item.name}</span>`).join("");
  drawLineChart("allModelsChart", allSeries, { lastObservedYear });
}

function renderProjection() {
  if (!state.projection.length) return;
  const lastObserved = state.data[state.data.length - 1];
  const final = state.projection[state.projection.length - 1];
  $("#projectionLast").textContent = numberFormat.format(lastObserved.traffic);
  $("#projectionLastYear").textContent = `Observado en ${lastObserved.year}`;
  $("#projectionFinal").textContent = numberFormat.format(final.estimated);
  $("#projectionFinalYear").textContent = `Proyectado para ${final.year}`;
  $("#projectionFactor").textContent = (final.estimated / lastObserved.traffic).toFixed(3);
  $("#projectionTitle").textContent = `${state.best.name}: histórico y horizonte ${final.year}`;

  drawLineChart("projectionChart", [
    { name: "Observado", color: COLORS.observed, width: 2.6, points: true, values: state.data.map((row) => ({ x: row.year, y: row.traffic })) },
    { name: "Estimado", color: COLORS.selected, width: 3.4, values: state.projection.map((row) => ({ x: row.year, y: row.estimated })) },
  ], { lastObservedYear: lastObserved.year });

  $("#projectionBody").innerHTML = state.projection.map((row) => `
    <tr>
      <td>${row.year}</td>
      <td>${row.observed === null ? "—" : numberFormat.format(row.observed)}</td>
      <td>${numberFormat.format(row.estimated)}</td>
      <td><span class="model-pill ${row.stage === "Proyección" ? "winner" : "candidate"}">${row.stage}</span></td>
      <td>${row.growth === null ? "—" : formatPercent(row.growth)}</td>
    </tr>`).join("");
}

function renderPavement() {
  if (!state.esal) return;
  $("#esalResult").textContent = numberFormat.format(state.esalTotal);
  $("#kpiEsal").textContent = compactNumber(state.esalTotal);
  drawLineChart("esalChart", [
    { name: "ESAL acumulado", color: COLORS.exponential, width: 3.2, points: true, values: state.esal.map((row) => ({ x: row.year, y: row.cumulative })) },
  ], {});
}

function renderScenario() {
  if (!state.scenario) return;
  const result = state.scenario;
  $("#scenarioState").textContent = result.label;
  $("#scenarioRatio").textContent = result.ratio.toFixed(3);
  $("#scenarioDemand").textContent = numberFormat.format(result.demand);
  $("#scenarioCapacity").textContent = numberFormat.format(result.capacity);
  $("#scenarioRecommendation").textContent = result.recommendation;
  $("#stateOrb").style.background = result.color;
  $("#stateOrb").style.boxShadow = `0 0 0 8px ${hexToRgba(result.color, 0.14)}`;
  $("#scenarioResultCard").style.borderTopColor = result.color;
  $("#ratioFill").style.width = `${Math.min(result.ratio / 1.25 * 100, 100)}%`;
  $("#ratioFill").style.background = result.color;
}

function drawLineChart(containerId, series, options = {}) {
  const container = $(`#${containerId}`);
  if (!container) return;
  const all = series.flatMap((item) => item.values).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!all.length) { container.innerHTML = "<p>No hay datos para graficar.</p>"; return; }
  const width = 1000;
  const height = container.classList.contains("large") ? 455 : 360;
  const margin = { left: 76, right: 24, top: 22, bottom: 52 };
  const minX = Math.min(...all.map((point) => point.x));
  const maxX = Math.max(...all.map((point) => point.x));
  const rawMinY = Math.min(...all.map((point) => point.y));
  const rawMaxY = Math.max(...all.map((point) => point.y));
  const paddingY = Math.max((rawMaxY - rawMinY) * 0.10, rawMaxY * 0.03, 1);
  const minY = Math.max(0, rawMinY - paddingY);
  const maxY = rawMaxY + paddingY;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xScale = (x) => margin.left + ((x - minX) / Math.max(maxX - minX, 1)) * plotW;
  const yScale = (y) => margin.top + plotH - ((y - minY) / Math.max(maxY - minY, 1)) * plotH;
  const xTicks = makeTicks(minX, maxX, 6).map(Math.round).filter((value, index, array) => array.indexOf(value) === index);
  const yTicks = makeTicks(minY, maxY, 5);

  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfico de series vehiculares">`;
  yTicks.forEach((tick) => {
    const y = yScale(tick);
    svg += `<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>`;
    svg += `<text class="chart-label" x="${margin.left - 12}" y="${y + 4}" text-anchor="end">${compactNumber(tick)}</text>`;
  });
  xTicks.forEach((tick) => {
    const x = xScale(tick);
    svg += `<line class="chart-grid" x1="${x}" y1="${margin.top}" x2="${x}" y2="${margin.top + plotH}"></line>`;
    svg += `<text class="chart-label" x="${x}" y="${height - 21}" text-anchor="middle">${tick}</text>`;
  });
  svg += `<line class="chart-axis" x1="${margin.left}" y1="${margin.top + plotH}" x2="${width - margin.right}" y2="${margin.top + plotH}"></line>`;
  if (options.lastObservedYear && options.lastObservedYear > minX && options.lastObservedYear < maxX) {
    const splitX = xScale(options.lastObservedYear);
    svg += `<rect x="${splitX}" y="${margin.top}" width="${width - margin.right - splitX}" height="${plotH}" fill="rgba(164,163,206,.10)"></rect>`;
    svg += `<line x1="${splitX}" y1="${margin.top}" x2="${splitX}" y2="${margin.top + plotH}" stroke="#9595b3" stroke-dasharray="5 5"></line>`;
    svg += `<text class="chart-label" x="${splitX + 8}" y="${margin.top + 15}">Proyección</text>`;
  }
  series.forEach((item) => {
    const sorted = item.values.slice().sort((a, b) => a.x - b.x);
    const path = sorted.map((point, index) => `${index ? "L" : "M"}${xScale(point.x).toFixed(2)},${yScale(point.y).toFixed(2)}`).join(" ");
    svg += `<path d="${path}" fill="none" stroke="${item.color}" stroke-width="${item.width || 2}" stroke-linecap="round" stroke-linejoin="round" ${item.dash ? `stroke-dasharray="${item.dash}"` : ""}></path>`;
    if (item.points) {
      sorted.forEach((point) => {
        svg += `<circle cx="${xScale(point.x)}" cy="${yScale(point.y)}" r="4.2" fill="white" stroke="${item.color}" stroke-width="2.5"><title>${item.name}: ${point.x} · ${numberFormat.format(point.y)}</title></circle>`;
      });
    }
  });
  svg += `<line class="chart-hover-line" x1="0" y1="${margin.top}" x2="0" y2="${margin.top + plotH}" style="display:none"></line>`;
  svg += "</svg>";
  container.innerHTML = svg;
  bindChartInteraction(container, series, { width, margin, plotH, minX, maxX, xScale });
}

function bindChartInteraction(container, series, chart) {
  const svg = $("svg", container);
  const hoverLine = $(".chart-hover-line", container);
  if (!svg || !hoverLine) return;
  const tooltip = document.createElement("div");
  tooltip.className = "floating-chart-tooltip";
  container.appendChild(tooltip);
  const xValues = [...new Set(series.flatMap((item) => item.values.map((point) => point.x)))].sort((a, b) => a - b);

  const move = (event) => {
    const rect = svg.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * chart.width;
    const estimatedX = chart.minX + ((viewX - chart.margin.left) / Math.max(chart.width - chart.margin.left - chart.margin.right, 1)) * (chart.maxX - chart.minX);
    const nearestX = xValues.reduce((closest, value) => Math.abs(value - estimatedX) < Math.abs(closest - estimatedX) ? value : closest, xValues[0]);
    const values = series.map((item) => ({ item, point: item.values.find((point) => point.x === nearestX) })).filter((entry) => entry.point);
    const lineX = chart.xScale(nearestX);
    hoverLine.setAttribute("x1", lineX);
    hoverLine.setAttribute("x2", lineX);
    hoverLine.style.display = "block";
    tooltip.innerHTML = `<strong>Año ${nearestX}</strong>${values.map(({ item, point }) => `<span><em style="color:${item.color}">● ${item.name}</em><b>${numberFormat.format(point.y)}</b></span>`).join("")}`;
    const localX = event.clientX - containerRect.left;
    const localY = event.clientY - containerRect.top;
    tooltip.style.left = `${Math.max(95, Math.min(localX, containerRect.width - 95))}px`;
    tooltip.style.top = `${Math.max(74, localY)}px`;
    tooltip.classList.add("show");
  };
  const leave = () => {
    hoverLine.style.display = "none";
    tooltip.classList.remove("show");
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerleave", leave);
}

function drawBarChart(containerId, items) {
  const container = $(`#${containerId}`);
  if (!container || !items.length) return;
  const width = 520;
  const height = 300;
  const margin = { left: 55, right: 14, top: 18, bottom: 70 };
  const maxValue = Math.max(...items.map((item) => item.value)) * 1.12;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const slot = plotW / items.length;
  const barWidth = Math.min(70, slot * 0.58);
  let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Comparación del error de validación">`;
  makeTicks(0, maxValue, 4).forEach((tick) => {
    const y = margin.top + plotH - (tick / maxValue) * plotH;
    svg += `<line class="chart-grid" x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"></line>`;
    svg += `<text class="chart-label" x="${margin.left - 8}" y="${y + 4}" text-anchor="end">${Math.round(tick)}</text>`;
  });
  items.forEach((item, index) => {
    const x = margin.left + slot * index + (slot - barWidth) / 2;
    const barHeight = (item.value / maxValue) * plotH;
    const y = margin.top + plotH - barHeight;
    svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8" fill="${item.color}"><title>${item.label}: ${decimalFormat.format(item.value)}</title></rect>`;
    svg += `<text class="chart-label" x="${x + barWidth / 2}" y="${height - 35}" text-anchor="middle">${item.label}</text>`;
  });
  svg += "</svg>";
  container.innerHTML = svg;
}

function printTechnicalReport() {
  prepareTechnicalReport();
  requestAnimationFrame(() => window.print());
}

function prepareTechnicalReport() {
  if (!state.best || !state.projection.length) return;
  const report = $("#printReport");
  report.setAttribute("aria-hidden", "false");
  const lastObserved = state.data[state.data.length - 1];
  const final = state.projection[state.projection.length - 1];
  const selected = state.models.find((model) => model.key === state.selectedModelKey) || state.best;
  const confidenceRatio = state.best.metrics.cvRmse / average(state.data.map((row) => row.traffic));
  const confidence = confidenceRatio < 0.04 ? "alta" : confidenceRatio < 0.08 ? "moderada" : "revisable";

  $("#reportDate").textContent = new Intl.DateTimeFormat("es-PE", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  $("#reportBestModel").textContent = state.best.name;
  $("#reportDesignTraffic").textContent = `${numberFormat.format(final.estimated)} veh/día`;
  $("#reportDesignYear").textContent = `Año ${final.year}`;
  $("#reportGrowth").textContent = formatPercent(state.growth.weighted);
  $("#reportEsal").textContent = compactNumber(state.esalTotal);
  $("#reportConclusion").innerHTML = `<strong>Interpretación:</strong> ${state.best.name} obtuvo el menor error de validación cruzada (${decimalFormat.format(state.best.metrics.cvRmse)} veh/día) y una consistencia predictiva ${confidence}. Con este modelo, el tráfico pasa de ${numberFormat.format(lastObserved.traffic)} veh/día en ${lastObserved.year} a ${numberFormat.format(final.estimated)} veh/día en ${final.year}.`;
  const reportChecks = {
    reportValidationData: state.data.length >= 5,
    reportValidationStat: state.best.metrics.r2 >= 0.75 && state.best.metrics.mape <= 15,
    reportValidationCross: confidenceRatio <= 0.15,
    reportValidationRoad: final.estimated >= 0 && state.growth.weighted >= -0.05 && state.growth.weighted <= 0.15,
  };
  Object.entries(reportChecks).forEach(([id, pass]) => {
    const element = $(`#${id}`);
    element.textContent = pass ? "APROBADO" : "REVISAR";
    element.parentElement.classList.toggle("warning", !pass);
  });

  $("#reportDataBody").innerHTML = state.data.map((row, index) => {
    const previous = state.data[index - 1];
    const variation = previous ? formatPercent(row.traffic / previous.traffic - 1) : "—";
    return `<tr><td>${row.year}</td><td>${numberFormat.format(row.traffic)} veh/día</td><td>${variation}</td></tr>`;
  }).join("");

  $("#reportMetricsBody").innerHTML = state.models.map((model) => `
    <tr><td><strong>${model.name}${model.key === state.best.key ? " · Recomendado" : ""}</strong></td>
    <td>${model.metrics.r2.toFixed(6)}</td><td>${decimalFormat.format(model.metrics.rmse)} veh/día</td>
    <td>${model.metrics.mape.toFixed(2)}%</td><td>${decimalFormat.format(model.metrics.cvRmse)} veh/día</td></tr>`).join("");

  const firstYear = state.data[0].year;
  const years = Array.from({ length: final.year - firstYear + 1 }, (_, index) => firstYear + index);
  const observed = { name: "Observado", color: COLORS.observed, width: 2.6, points: true, values: state.data.map((row) => ({ x: row.year, y: row.traffic })) };
  const allModels = [observed, ...state.models.map((model) => ({
    name: model.name, color: model.color, width: model.key === state.best.key ? 3.2 : 1.7,
    dash: model.key === state.best.key ? "" : "7 5", values: years.map((year) => ({ x: year, y: model.predict(year) })),
  }))];
  drawLineChart("reportAllModelsChart", allModels, { lastObservedYear: lastObserved.year });
  $("#reportEquation").innerHTML = `<strong>Modelo visualizado por el usuario: ${selected.name}</strong><br>${selected.equation}<br><span>Modelo recomendado por el sistema: ${state.best.name}, debido a su menor error de validación cruzada.</span>`;

  drawLineChart("reportProjectionChart", [
    observed,
    { name: `Proyección ${state.best.name}`, color: COLORS.selected, width: 3.4, points: true, values: state.projection.map((row) => ({ x: row.year, y: row.estimated })) },
  ], { lastObservedYear: lastObserved.year });
  $("#reportProjectionBody").innerHTML = state.projection.map((row) => `
    <tr><td>${row.year}</td><td>${row.observed === null ? "—" : numberFormat.format(row.observed)}</td>
    <td>${numberFormat.format(row.estimated)}</td><td>${row.stage}</td><td>${row.growth === null ? "—" : formatPercent(row.growth)}</td></tr>`).join("");

  $("#reportGrowthDetail").textContent = `${formatPercent(state.growth.weighted)} anual, equivalente a un factor ${state.growth.factor.toFixed(4)}. Los años recientes reciben mayor peso.`;
  $("#reportEsalDetail").textContent = `${numberFormat.format(state.esalTotal)} ejes equivalentes referenciales para ${lastObserved.year + 1}–${final.year}.`;
  drawLineChart("reportEsalChart", [
    { name: "Ejes equivalentes acumulados", color: COLORS.exponential, width: 3.2, points: true, values: state.esal.map((row) => ({ x: row.year, y: row.cumulative })) },
  ]);
  $("#reportFindings").innerHTML = `
    <li>El modelo ${state.best.name} presenta la mejor capacidad predictiva entre los modelos evaluados.</li>
    <li>El crecimiento anual promedio ponderado de la serie es ${formatPercent(state.growth.weighted)}.</li>
    <li>Para ${final.year} se estima un tráfico de ${numberFormat.format(final.estimated)} vehículos por día.</li>
    <li>El tránsito equivalente acumulado es ${numberFormat.format(state.esalTotal)} ejes, sujeto a los factores ingresados.</li>`;
}

function exportProjectionCsv() {
  if (!state.projection.length) return;
  const rows = ["Año,Tráfico observado,Tráfico estimado,Etapa,Crecimiento"];
  state.projection.forEach((row) => rows.push([
    row.year,
    row.observed ?? "",
    row.estimated.toFixed(3),
    row.stage,
    row.growth === null ? "" : row.growth.toFixed(6),
  ].join(",")));
  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "proyeccion_qhapaq_ia.csv";
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Proyección descargada en formato CSV.");
}

function showToast(message, isError = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function makeTicks(min, max, count) {
  if (count <= 1) return [min];
  return Array.from({ length: count }, (_, index) => min + (max - min) * index / (count - 1));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatEquationNumber(value) {
  if (Math.abs(value) >= 100) return value.toFixed(3);
  return value.toFixed(6);
}

function formatSigned(value) {
  return `${value >= 0 ? "+" : "−"}${formatEquationNumber(Math.abs(value))}`;
}

function compactNumber(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1e9) return `${(value / 1e9).toFixed(2)} mil M`;
  if (absolute >= 1e6) return `${(value / 1e6).toFixed(2)} M`;
  if (absolute >= 1e3) return `${(value / 1e3).toFixed(1)} mil`;
  return numberFormat.format(value);
}

function hexToRgba(hex, alpha) {
  const cleaned = hex.replace("#", "");
  const value = parseInt(cleaned, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}
