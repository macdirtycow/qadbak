#!/usr/bin/env python3
"""Assign latest Qadbak build to external TestFlight and submit for Beta App Review."""

from __future__ import annotations

import argparse
import json
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

try:
    import certifi
    import jwt
except ImportError:
    print("Install: pip3 install --user PyJWT cryptography certifi", file=sys.stderr)
    raise SystemExit(1)

BUNDLE_ID = "com.qadbak.panel"
GROUP_NAME = "External Testers"
BASE = "https://api.appstoreconnect.apple.com/v1"
CTX = ssl.create_default_context(cafile=certifi.where())


def make_token(key_path: Path, key_id: str, issuer_id: str) -> str:
    key = key_path.read_text()
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer_id, "exp": now + 1200, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": key_id, "typ": "JWT"},
    )


def api(method: str, path: str, auth: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {auth}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=90, context=CTX) as resp:
        return json.loads(resp.read().decode())


def wait_for_valid_build(auth: str, app_id: str, version: str, build: str, tries: int = 30) -> str:
    for attempt in range(tries):
        builds = api(
            "GET",
            f"/builds?filter[app]={app_id}&filter[version]={version}&limit=20&sort=-uploadedDate",
            auth,
        )
        for row in builds.get("data", []):
            attrs = row.get("attributes", {})
            if str(attrs.get("version")) != build:
                continue
            state = attrs.get("processingState")
            if state == "VALID":
                return row["id"]
            if state in {"FAILED", "INVALID"}:
                raise RuntimeError(f"Build processing failed: {state}")
        print(f"… waiting for build {version} ({build}) to process ({attempt + 1}/{tries})")
        time.sleep(30)
    raise RuntimeError("Build not VALID yet — try again in a few minutes.")


def ensure_external_group(auth: str, app_id: str) -> str:
    groups = api("GET", f"/apps/{app_id}/betaGroups?limit=200", auth)
    for row in groups.get("data", []):
        attrs = row.get("attributes", {})
        if attrs.get("name") == GROUP_NAME and not attrs.get("isInternalGroup", True):
            return row["id"]
    created = api(
        "POST",
        "/betaGroups",
        auth,
        {
            "data": {
                "type": "betaGroups",
                "attributes": {"name": GROUP_NAME, "isInternalGroup": False},
                "relationships": {"app": {"data": {"type": "apps", "id": app_id}}},
            }
        },
    )
    return created["data"]["id"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key-id", default="TXY8G26YBJ")
    parser.add_argument(
        "--key-path",
        type=Path,
        default=Path.home() / "Downloads" / f"AuthKey_TXY8G26YBJ.p8",
    )
    parser.add_argument("--issuer-id", default=__import__("os").environ.get("ASC_ISSUER_ID", ""))
    parser.add_argument("--version", default="1.1.5")
    parser.add_argument("--build", default="3")
    parser.add_argument("--wait", action="store_true", help="Poll until build is VALID")
    args = parser.parse_args()

    if not args.issuer_id:
        print("Set ASC_ISSUER_ID or pass --issuer-id", file=sys.stderr)
        return 1
    if not args.key_path.is_file():
        print(f"Missing API key: {args.key_path}", file=sys.stderr)
        return 1

    auth = make_token(args.key_path, args.key_id, args.issuer_id)

    try:
        apps = api("GET", f"/apps?filter[bundleId]={BUNDLE_ID}&limit=1", auth)
    except urllib.error.HTTPError as err:
        print(f"API auth failed {err.code}: {err.read().decode()}", file=sys.stderr)
        return 1

    if not apps.get("data"):
        print(f"App {BUNDLE_ID} not found in App Store Connect.", file=sys.stderr)
        return 1

    app_id = apps["data"][0]["id"]
    app_name = apps["data"][0]["attributes"]["name"]
    print(f"App: {app_name} ({app_id})")

    if args.wait:
        build_id = wait_for_valid_build(auth, app_id, args.version, args.build)
    else:
        builds = api(
            "GET",
            f"/builds?filter[app]={app_id}&filter[version]={args.version}&limit=20&sort=-uploadedDate",
            auth,
        )
        build_id = None
        for row in builds.get("data", []):
            if str(row.get("attributes", {}).get("version")) == args.build:
                build_id = row["id"]
                state = row["attributes"].get("processingState")
                print(f"Build state: {state}")
                break
        if not build_id:
            print("Build not found yet. Upload first, then rerun with --wait.", file=sys.stderr)
            return 1

    group_id = ensure_external_group(auth, app_id)
    print(f"External group: {GROUP_NAME} ({group_id})")

    api(
        "POST",
        f"/betaGroups/{group_id}/relationships/builds",
        auth,
        {"data": [{"type": "builds", "id": build_id}]},
    )
    print("Build linked to external group.")

    try:
        api(
            "POST",
            "/betaAppReviewSubmissions",
            auth,
            {
                "data": {
                    "type": "betaAppReviewSubmissions",
                    "relationships": {"build": {"data": {"type": "builds", "id": build_id}}},
                }
            },
        )
        print("Submitted for External TestFlight Beta App Review.")
    except urllib.error.HTTPError as err:
        body = err.read().decode()
        if "already exists" in body.lower() or err.code == 409:
            print("Beta review already submitted for this build.")
        else:
            print(f"Beta review submit {err.code}: {body}", file=sys.stderr)
            print("Finish in App Store Connect → TestFlight → External Testing.", file=sys.stderr)
            return 1

    print("Done. Add testers under External Testing when Apple approves the build.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
