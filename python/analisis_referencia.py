"""Cálculo de referencia del ejemplo incluido en PaviEtrans.

Este archivo demuestra la misma idea del ajuste lineal utilizando únicamente
la biblioteca estándar de Python. La aplicación web funciona directamente con
JavaScript y no necesita ejecutar este script.
"""

from __future__ import annotations

import json
import math
from pathlib import Path


RUTA_DATOS = Path(__file__).resolve().parents[1] / "data" / "ejemplo.json"


def ajuste_lineal(anios: list[int], traficos: list[float]) -> tuple[float, float, int]:
    """Devuelve intercepto, pendiente y año base de T(x)=a+b*x."""

    anio_base = min(anios)
    x = [anio - anio_base for anio in anios]
    media_x = sum(x) / len(x)
    media_y = sum(traficos) / len(traficos)
    numerador = sum((xi - media_x) * (yi - media_y) for xi, yi in zip(x, traficos))
    denominador = sum((xi - media_x) ** 2 for xi in x)
    pendiente = numerador / denominador
    intercepto = media_y - pendiente * media_x
    return intercepto, pendiente, anio_base


def metricas(observados: list[float], estimados: list[float]) -> tuple[float, float]:
    """Calcula R² y RMSE."""

    media = sum(observados) / len(observados)
    ss_res = sum((y - yh) ** 2 for y, yh in zip(observados, estimados))
    ss_tot = sum((y - media) ** 2 for y in observados)
    r2 = 1 - ss_res / ss_tot
    rmse = math.sqrt(ss_res / len(observados))
    return r2, rmse


def main() -> None:
    contenido = json.loads(RUTA_DATOS.read_text(encoding="utf-8"))
    observaciones = contenido["observaciones"]
    anios = [fila["anio"] for fila in observaciones]
    traficos = [float(fila["trafico"]) for fila in observaciones]
    a, b, base = ajuste_lineal(anios, traficos)
    estimados = [a + b * (anio - base) for anio in anios]
    r2, rmse = metricas(traficos, estimados)

    print("PaviEtrans — verificación lineal del ejemplo")
    print(f"T(x) = {a:.4f} + {b:.4f}x, x = Año - {base}")
    print(f"R² = {r2:.6f}")
    print(f"RMSE = {rmse:.3f} vehículos/día")


if __name__ == "__main__":
    main()
