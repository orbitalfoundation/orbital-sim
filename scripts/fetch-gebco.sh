#!/usr/bin/env bash
# Download the GEBCO 2026 global GeoTIFF dataset and extract the tiles.
# This is a one-time operation — the download is ~3 GB (zip), expands to ~7 GB.
# After this, run gebco-downsample.mjs to generate the 18 MB working raster.
#
# Full pipeline:
#   bash scripts/fetch-gebco.sh             # ~3 GB download, extracts to public/.data/elevation/global_15arcsec.i16/
#   node scripts/gebco-downsample.mjs       # generates public/.data/elevation/global_5arcmin.i16 (~30 s)
#   bash scripts/sync-data.sh               # push to remote server (if deploying)

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="$REPO_DIR/public/.data/elevation/global_15arcsec.i16"
ZIP_FILE="$REPO_DIR/public/.data/elevation/global_15arcsec.i16_geotiff.zip"
GEBCO_URL="https://dap.ceda.ac.uk/bodc/gebco/global/gebco_2026/ice_surface_elevation/geotiff/gebco_2026_geotiff.zip?download=1"

echo "GEBCO 2026 — ice surface elevation GeoTIFF"
echo "Destination: $DEST_DIR"
echo ""

# Check if tiles already exist
EXISTING=$(ls "$DEST_DIR"/*.tif 2>/dev/null | wc -l | tr -d ' ')
if [ "$EXISTING" -gt 0 ]; then
  echo "Found $EXISTING tile(s) already in $DEST_DIR."
  read -r -p "Re-download and overwrite? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

mkdir -p "$DEST_DIR"

echo "Downloading (~3 GB zip)..."
curl -L --progress-bar -o "$ZIP_FILE" "$GEBCO_URL"
echo ""

echo "Extracting tiles..."
unzip -j "$ZIP_FILE" "*.tif" -d "$DEST_DIR"
rm "$ZIP_FILE"

TILE_COUNT=$(ls "$DEST_DIR"/*.tif 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Done. $TILE_COUNT tile(s) in $DEST_DIR"
echo ""
echo "Next step — generate the 18 MB working raster:"
echo "  node scripts/gebco-downsample.mjs"
