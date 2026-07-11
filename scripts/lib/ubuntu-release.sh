#!/usr/bin/env bash
# Backward-compatible wrapper — prefer scripts/lib/linux-distro.sh for new code.
# shellcheck shell=bash
# shellcheck source=linux-distro.sh
source "$(dirname "${BASH_SOURCE[0]}")/linux-distro.sh"
