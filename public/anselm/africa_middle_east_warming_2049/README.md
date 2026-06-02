# Africa / Middle East Warming — 2049 Scenario

Scenario stub for modeling accelerated surface warming in the Middle East and North Africa (MENA),
grounded in the findings of Malik et al. (2024).

## Reference

Malik, A., Stenchikov, G., Mostamandi, S., Parajuli, S., Lelieveld, J., Zittis, G., Ahsan, M. S.,
Atique, L., & Usman, M. (2024). Accelerated historical and future warming in the Middle East and
North Africa. *Journal of Geophysical Research: Atmospheres*.
https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2024JD041625

## Key findings

- MENA is currently warming at 1.5–3.5× the global average rate — on par with the Arctic.
- By 2100, inland Arabian Peninsula could see +7.6 °C (low-emissions) to +9 °C (high-emissions).
- The region will cross 3 °C and 4 °C of warming nearly three decades earlier than the rest of the world.
- Warming is spatially uneven: inland hotspots over central Saudi Arabia, Algeria, and Iran's Elburz
  Mountains; coastal zones (Oman, Red Sea) warm more slowly due to maritime cooling.
- Summer hotspots dominate the Arabian Peninsula and Algeria; winter hotspots over Mauritania and
  the Elburz.

## Mechanism

The amplification is not the same as Arctic amplification (which is driven by ice-albedo feedback).
In MENA it is a **moisture-temperature feedback**:

- In humid regions, extra radiative energy drives evapotranspiration, which consumes heat and
  limits temperature rise.
- Desert soils have negligible moisture. Almost no energy is lost to evaporation, so nearly all net
  incoming energy converts directly to sensible heat.
- The result: a given increment of CO₂ forcing produces far more surface warming over dry land
  than over vegetated or ocean-adjacent surfaces.

## Modeling approach (planned)

A per-cell surface energy balance updated each tick:

```
ΔT = (insolation × (1 − albedo) + ΔF_CO2 − ET(soil_moisture, T)) / heat_capacity
```

Key inputs needed beyond what the framework already provides:

| Input | Resolution | Source |
|---|---|---|
| Insolation | per cell, per tick | `bus.insolation` ✓ |
| Elevation / terrain | 5 arc-min global | GEBCO 2026 ✓ |
| Land cover / soil moisture | ~300 m | ESA CCI Land Cover |
| Albedo | per land cover class | lookup table |
| CO₂ scenario | scalar time series | IPCC RCP 2.6 / 4.5 / 8.5 |

CO₂ radiative forcing follows the standard approximation: ΔF = 5.35 × ln(C / C₀) W m⁻².

## What this model will and won't capture

**Will capture:** the spatial pattern of differential warming (deserts > humid regions > coasts),
sensitivity to emissions scenario, and the mechanism by which dryness amplifies warming.

**Won't capture:** ocean heat uptake, atmospheric circulation shifts (jet stream, monsoon
changes), cloud feedbacks, or aerosol effects. These require a full GCM.

## Demo value

An interactive emissions-scenario slider showing spatially resolved warming by 2049 and 2099,
with uninhabitability threshold overlays (wet-bulb temperature > 35 °C), would illustrate the
core mechanism in a way that is directly quotable and tied to a high-profile, current research result.
