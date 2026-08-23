PavimEstudio 2.0 — GRUPO 03 · PAVIMENTOS
=======================================

Universidad Nacional de Huancavelica
Facultad de Ingeniería Civil
Docente: Vargas Crispin, Wilber Samuel

CÓMO ABRIR LA PÁGINA
--------------------
1. Descomprime completamente el archivo ZIP.
2. Abre la carpeta PavimEstudio_GRUPO_03_WEB.
3. Haz doble clic en index.html.

También puedes utilizar ABRIR_WEB.bat en Windows.

No se necesita instalar Python, Node.js, librerías ni un servidor. Todos los
cálculos y gráficos principales funcionan localmente con JavaScript.

ARCHIVOS
--------
- index.html: estructura principal y contenido académico.
- styles.css: diseño responsivo con la paleta del escudo de Ingeniería Civil.
- app.js: regresiones, métricas, proyección, gráficos, ESAL y escenarios.
- assets/escudo-fic.png: identidad visual proporcionada para el proyecto.
- data/ejemplo.json: datos demostrativos y metadatos académicos.
- python/analisis_referencia.py: verificación opcional del ajuste lineal.

FUNCIONES PRINCIPALES
---------------------
- Tabla histórica editable e importación CSV.
- Regresión lineal, exponencial y polinomial.
- Cuatro controles: integridad de datos, ajuste estadístico, validación cruzada
  y coherencia vial. Se supera el mínimo solicitado de tres validaciones.
- R², raíz del error cuadrático medio y error porcentual para comparar modelos.
- Ayudas emergentes que explican cada indicador al acercar el cursor.
- Selección automática del modelo con menor error de validación.
- Gráfica individual para cada modelo y comparación conjunta interactiva.
- Proyección anual hasta el año de diseño.
- Crecimiento anual promedio ponderado.
- Tránsito equivalente ESAL referencial para pavimentos.
- Laboratorio demanda/capacidad.
- Descarga de la proyección en CSV.
- Informe técnico con encabezado institucional, escudo, datos, indicadores,
  gráficas, proyecciones, crecimiento vehicular y ejes equivalentes.
- Ilustraciones técnicas propias en las pestañas principales.

IMPORTANTE
----------
Los valores del ejemplo son demostrativos. Para un proyecto definitivo deben
reemplazarse con conteos oficiales, composición vehicular y factores técnicos
obtenidos según la metodología de diseño adoptada.
