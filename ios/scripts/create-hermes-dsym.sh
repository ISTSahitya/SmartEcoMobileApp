#!/bin/sh
set -e

HERMES_BINARY="${PODS_ROOT}/hermes-engine/destroot/Library/Frameworks/universal/hermesvm.xcframework/ios-arm64/hermesvm.framework/hermesvm"

if [ ! -f "$HERMES_BINARY" ]; then
  echo "warning: Hermes binary not found at $HERMES_BINARY"
  exit 0
fi

if [ -n "$ARCHIVE_PRODUCTS_PATH" ]; then
  ARCHIVE_PATH="${ARCHIVE_PRODUCTS_PATH%/Products}"
  DSYM_OUTPUT_DIR="${ARCHIVE_PATH}/dSYMs"
else
  DSYM_OUTPUT_DIR="${DWARF_DSYM_FOLDER_PATH}"
fi

if [ -z "$DSYM_OUTPUT_DIR" ]; then
  echo "warning: dSYM output path is not available"
  exit 0
fi

mkdir -p "$DSYM_OUTPUT_DIR"
if /usr/bin/dsymutil "$HERMES_BINARY" -o "$DSYM_OUTPUT_DIR/hermesvm.framework.dSYM" 2>/dev/null; then
  echo "Created Hermes dSYM at $DSYM_OUTPUT_DIR/hermesvm.framework.dSYM"
else
  echo "warning: Failed to create Hermes dSYM"
fi
