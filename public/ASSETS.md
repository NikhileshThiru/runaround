# Visual Assets

## `data/countries-110m.geojson`

- Purpose: bundled country outlines for the production technical globe
- Source: Natural Earth, Admin 0 Countries, 1:110m cultural vectors
- Processing: removed unused feature metadata while preserving all geometry
- Project: https://www.naturalearthdata.com/
- License: public domain

## `data/us-states-50m.geojson`

- Purpose: bundled U.S. state outlines and capital-coordinate regression testing
- Source: Natural Earth, Admin 1 States/Provinces, 1:50m cultural vectors
- Processing: filtered to the 50 states plus District of Columbia before bundling
- Optimization: retained only geometry and two-letter postal codes used by route validation
- Project: https://www.naturalearthdata.com/
- License: public domain
