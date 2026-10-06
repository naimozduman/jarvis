"""Trusted-side V4.1 promotion evidence gate.

Reads candidate files as data. Does not execute tests or import candidate modules.
A signature authenticates an assertion. GitHub independently corroborates its run,
workflow revision, attempt, required jobs, artifact and report bytes. Neither proves
semantic adequacy of an approved test suite. Runtime activation remains separate.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from common import read_json, read_bytes, file_paths, sha
from impact import changed_paths, matching, operational_paths as classify_operational
from review_evidence import dt

TOOLS = Path(__file__).resolve().parent
SHA = re.compile(r"^[0-9a-f]{40}$")
HASH = re.compile(r"^[0-9a-f]{64}$")
REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def strict_load(raw: bytes | str) -> Any:
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "Duplicate JSON key")
            result[key] = value
        return result
    return json.loads(raw, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))


def integer(value: Any, label: str, minimum: int = 1) -> int:
    require(type(value) is int and value >= minimum, "Invalid " + label)
    return value


def exact_keys(value: dict, keys: set[str], label: str) -> None:
    require(isinstance(value, dict) and set(value) == keys, "Unexpected fields: " + label)


def coverage(root: Path, entry: dict, invariants: dict) -> dict:
    """Digest the actual candidate suite sources plus their canonical invariant text.

    A trusted catalog controls the glob set. The candidate cannot choose its own test
    paths. Missing/empty coverage is a failure, including for planned requirements.
    """
    patterns = entry.get("coveragePatterns", [])
    require(isinstance(patterns, list) and patterns and all(isinstance(p, str) for p in patterns),
            entry["id"] + ": eval sources not mapped; reconcile before activation")
    paths = sorted(p for p in file_paths(root) if matching(p, patterns))
    require(bool(paths), entry["id"] + ": no matching eval source files")
    require(entry.get("path") in paths, entry["id"] + ": required entrypoint is not in coverage")
    rules = {r["id"]: r["text"] for r in invariants["rules"]}
    selected = []
    for identity in entry.get("invariantIds", []):
        require(identity in rules, "Unknown invariant: " + identity)
        selected.append({"id": identity, "text": rules[identity]})
    data = {"evalId": entry["id"], "patterns": patterns,
            "files": [{"path": p, "sha256": sha(read_bytes(root, p))} for p in paths],
            "invariants": sorted(selected, key=lambda x: x["id"])}
    # This digest is a format specific to this tool, not the JS canonical signature encoding.
    digest = sha(json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode())
    return {"evalId": entry["id"], "coverageDigest": digest, "testPaths": paths}


def requirements(paths: list[str], base: Path, candidate: Path, operational_paths=()) -> dict:
    mapping = read_json(base, "governance/IMPLEMENTATION_MAP.json")
    policy = read_json(base, "governance/EVIDENCE_POLICY.json")
    # CLI obtains exemptions from the trusted mode-aware Git-tree classifier.
    # Programmatic calls default to NO exemptions, never infer from filename alone.
    inspected = [p for p in paths if p not in set(operational_paths)]
    affected = [a for a in mapping["areas"] if any(matching(p, a["codePatterns"]) for p in inspected)]
    unknown = [p for p in inspected if not any(matching(p, a["codePatterns"]) for a in mapping["areas"])]
    require(not unknown, "Unmapped source paths: " + ", ".join(unknown))
    needed = set()
    for area in affected:
        require(bool(area.get("requiredEvalIds")), "Area lacks a trusted eval requirement: " + area["id"])
        needed.update(area["requiredEvalIds"])
    # A new deployment claim or live control cannot use a documentation-only evidence lane.
    old = {c["id"]: c for c in read_json(base, "governance/CONTROL_MATRIX.json")["controls"]}
    new = read_json(candidate, "governance/CONTROL_MATRIX.json")["controls"]
    active = set(policy["activeControlStates"])
    activations = []
    for control in new:
        if control["status"] in active and old.get(control["id"], {}).get("status") not in active:
            ids = policy["activationRequirements"].get(control["id"])
            require(bool(ids), "Unmapped runtime activation: " + control["id"])
            needed.update(ids)
            activations.append(control["id"])
    old_schemas = {c["contractId"]: c for c in read_json(base, "governance/SCHEMA_REGISTRY.json")["contracts"]}
    for contract in read_json(candidate, "governance/SCHEMA_REGISTRY.json")["contracts"]:
        if contract["status"] in ["migrating", "active"] and old_schemas.get(contract["contractId"], {}).get("status") not in ["migrating", "active"]:
            needed.update(policy["activationRequirements"]["SCHEMA-01"])
            activations.append(contract["contractId"])
    catalog = read_json(base, "governance/EVAL_CATALOG.json")
    entries = {e["id"]: e for e in catalog["entries"]}
    require(len(entries) == len(catalog["entries"]), "Duplicate trusted eval IDs")
    expected = {}
    invariants = read_json(candidate, "governance/INVARIANTS.json")
    for eid in sorted(needed):
        require(eid in entries, "Unregistered required eval: " + eid)
        expected[eid] = coverage(candidate, entries[eid], invariants)
    return {"expected": expected, "catalog": entries, "inspectedPaths": inspected,
            "affectedAreas": sorted(a["id"] for a in affected), "activations": activations}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class GitHubAPI:
    """Read-only GitHub API. Redirected artifact downloads never carry GH_TOKEN."""
    def __init__(self, token: str, max_bytes: int = 20_000_000):
        require(bool(token), "Read-only GitHub Actions token unavailable")
        self.token = token
        self.max_bytes = max_bytes
        self.opener = urllib.request.build_opener(NoRedirect())

    def _request(self, path: str):
        require(path.startswith("repos/") and not any(c in path for c in "\r\n"), "Invalid API path")
        return urllib.request.Request("https://api.github.com/" + path,
            headers={"Authorization": "Bearer " + self.token, "Accept": "application/vnd.github+json",
                     "X-GitHub-Api-Version": "2026-03-10", "User-Agent": "jarvis-v4.1-evidence"})

    @staticmethod
    def _read(response, limit):
        raw = response.read(limit + 1)
        require(len(raw) <= limit, "GitHub data exceeds size limit")
        return raw

    def json(self, path: str):
        try:
            with self.opener.open(self._request(path), timeout=30) as response:
                return strict_load(self._read(response, 4_000_000))
        except urllib.error.HTTPError as error:
            raise ValueError("GitHub metadata unavailable (HTTP %s)" % error.code) from None
        except urllib.error.URLError:
            raise ValueError("GitHub metadata transport unavailable") from None

    def archive(self, path: str) -> bytes:
        try:
            with self.opener.open(self._request(path), timeout=30) as response:
                return self._read(response, self.max_bytes)
        except urllib.error.HTTPError as error:
            require(error.code in [301, 302, 303, 307, 308], "Artifact download unavailable")
            location = error.headers.get("Location", "")
            u = urllib.parse.urlsplit(location)
            require(u.scheme == "https" and u.port in [None, 443] and not u.username and not u.password,
                    "Unsafe artifact redirect")
            host = u.hostname or ""
            require(host.endswith(".blob.core.windows.net") or host.endswith(".actions.githubusercontent.com") or
                    host == "objects.githubusercontent.com", "Unexpected artifact download host")
            # A separate opener/request has no Authorization header and refuses further redirects.
            try:
                with self.opener.open(urllib.request.Request(location), timeout=30) as response:
                    return self._read(response, self.max_bytes)
            except (urllib.error.URLError, urllib.error.HTTPError):
                raise ValueError("Artifact storage unavailable") from None
        except urllib.error.URLError:
            raise ValueError("Artifact transport unavailable") from None


def verify_signature(envelope: dict, policy_path: Path) -> None:
    # Tools path comes from this trusted module, never from candidate metadata.
    with tempfile.TemporaryDirectory(prefix="jarvis-evidence-") as directory:
        path = Path(directory) / "record.json"
        path.write_text(json.dumps(envelope))
        result = subprocess.run(["node", str(TOOLS / "evidence-signing.mjs"), "verify", "--policy", str(policy_path),
                                 "--record", str(path)], capture_output=True, text=True, timeout=30)
        require(result.returncode == 0, "Evidence signature or trust enrollment rejected")


def metadata_binding(payload: dict, policy: dict, api, now: datetime) -> tuple[dict, bytes]:
    """Cross-check a signed verifier claim with live platform records."""
    v = payload["verification"]
    exact_keys(v, {"verifierId", "runId", "runAttempt", "artifactId", "artifactSha256", "reportSha256"}, "verification")
    profile = next((x for x in policy["workflows"] if x["id"] == v["verifierId"]), None)
    require(profile is not None and profile.get("enabled") is True, "Verifier workflow not enrolled")
    require(payload["keyId"] in profile["receiptKeyIds"], "Signer not authorized for verifier workflow")
    require(bool(profile.get("requiredJobs")) and all(isinstance(j.get("steps"), list) and j["steps"] for j in profile["requiredJobs"]), "Verifier must name successful jobs AND required steps")
    require(type(profile.get("maxAgeSeconds")) is int and profile["maxAgeSeconds"]>0, "Invalid verifier freshness window")
    require(all(isinstance(s,str) and SHA.fullmatch(s) for s in profile["trustedHeadShas"]) and profile["trustedHeadShas"], "Verifier revisions must be pinned")
    repo = profile["repository"]
    require(REPO.fullmatch(repo) is not None, "Malformed enrolled repository")
    runid, attempt, artifactid = (integer(v[k], k) for k in ["runId", "runAttempt", "artifactId"])
    require(HASH.fullmatch(v["artifactSha256"]) is not None and HASH.fullmatch(v["reportSha256"]) is not None,
            "Invalid artifact/report digest")
    latest = api.json(f"repos/{repo}/actions/runs/{runid}")
    require(latest.get("run_attempt") == attempt, "Evidence references an obsolete rerun attempt")
    run = api.json(f"repos/{repo}/actions/runs/{runid}/attempts/{attempt}")
    require(run.get("id") == runid and run.get("run_attempt") == attempt and
            run.get("repository", {}).get("id") == profile["repositoryId"] and
            run.get("repository", {}).get("full_name") == repo, "Run identity mismatch")
    require(run.get("head_repository", {}).get("id") == profile["repositoryId"], "Unexpected verifier head repository")
    require(run.get("workflow_id") == profile["workflowId"] and run.get("event") == profile["event"], "Wrong workflow or event")
    require(run.get("head_sha") in profile["trustedHeadShas"] and run.get("head_branch") in profile["allowedBranches"],
            "Verifier ran unreviewed code or branch")
    require(run.get("path") in [profile["workflowPath"], profile["workflowPath"] + "@" + run["head_branch"]], "Wrong workflow path")
    require(run.get("status") == "completed" and run.get("conclusion") == "success", "Verifier run not successful")
    observed = dt(run["updated_at"])
    require(0 <= (now - observed).total_seconds() <= profile["maxAgeSeconds"], "Run is stale or future-dated")
    # Verify the workflow source bytes at the immutable verifier SHA as well as its numeric ID.
    source = api.json(f"repos/{repo}/contents/{profile['workflowPath']}?ref={run['head_sha']}")
    require(source.get("encoding") == "base64" and source.get("type") == "file", "Workflow source unavailable")
    body = base64.b64decode(source["content"].replace("\n", ""), validate=True)
    require(sha(body) == profile["workflowSha256"], "Workflow source digest mismatch")
    jobs = []
    for page in range(1, 11):
        response = api.json(f"repos/{repo}/actions/runs/{runid}/attempts/{attempt}/jobs?per_page=100&page={page}")
        rows = response.get("jobs")
        require(isinstance(rows, list), "Missing jobs metadata")
        jobs.extend(rows)
        if len(jobs) >= response.get("total_count", 10**9):
            break
    else:
        raise ValueError("Incomplete job listing")
    require(bool(profile.get("requiredJobs")), "Trusted workflow has no required jobs")
    for expected in profile["requiredJobs"]:
        matches = [j for j in jobs if j.get("name") == expected["name"]]
        require(len(matches) == 1, "Required job missing or ambiguous")
        job = matches[0]
        require(job.get("run_id") == runid and job.get("status") == "completed" and job.get("conclusion") == "success",
                "Required job skipped, failed or belongs to a different run")
        for name in expected["steps"]:
            steps = [s for s in job.get("steps", []) if s.get("name") == name]
            require(len(steps) == 1 and steps[0].get("conclusion") == "success" and steps[0].get("status") == "completed",
                    "Required verification step did not succeed")
    artifact = api.json(f"repos/{repo}/actions/artifacts/{artifactid}")
    require(artifact.get("id") == artifactid and artifact.get("name") == profile["artifactName"] and
            artifact.get("expired") is False, "Wrong or expired artifact")
    require(artifact.get("workflow_run", {}).get("id") == runid and
            artifact.get("workflow_run", {}).get("head_sha") == run["head_sha"], "Artifact run mismatch")
    require(artifact.get("digest") == "sha256:" + v["artifactSha256"], "Platform artifact digest mismatch or unavailable")
    require(type(artifact.get("size_in_bytes")) is int and 0 < artifact["size_in_bytes"] <= policy["maxArtifactBytes"],
            "Artifact size is invalid")
    # Reruns share a run ID. Corroborate attempt via artifact creation time and signed report.
    require(dt(artifact["created_at"]) >= dt(run.get("run_started_at", run["created_at"])), "Artifact predates this attempt")
    raw = api.archive(f"repos/{repo}/actions/artifacts/{artifactid}/zip")
    require(len(raw) <= policy["maxArtifactBytes"] and sha(raw) == v["artifactSha256"], "Downloaded artifact was altered")
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        require(len(entries) == 1 and entries[0].filename == "verification-report.json", "Unexpected archive members")
        entry = entries[0]
        require(entry.file_size <= policy["maxReportBytes"] and (entry.external_attr >> 16) & 0o170000 != 0o120000,
                "Oversized or linked report")
        report_bytes = archive.read(entry)
    require(sha(report_bytes) == v["reportSha256"], "Report digest mismatch")
    return run, report_bytes


def verify_tests(payload: dict, policy: dict, api, expected: dict, now: datetime) -> dict:
    run, data = metadata_binding(payload, policy, api, now)
    report = strict_load(data)
    exact_keys(report, {"schemaVersion", "subject", "verifier", "startedAt", "finishedAt", "suites"}, "test report")
    require(report["schemaVersion"] == 1, "Unsupported test report")
    require(report["subject"] == {k: payload[k] for k in ["repository", "base", "head"]}, "Report subject mismatch")
    v = payload["verification"]
    require(report["verifier"] == {"id": v["verifierId"], "runId": v["runId"], "runAttempt": v["runAttempt"],
                                  "sourceSha": run["head_sha"]}, "Report verifier mismatch")
    start, end = dt(report["startedAt"]), dt(report["finishedAt"])
    require(dt(run.get("run_started_at", run["created_at"])) <= start <= end <= dt(run["updated_at"]) <= now,
            "Impossible report/run timestamps")
    require(isinstance(report["suites"], list) and len(report["suites"]) <= 200, "Malformed suites")
    verified = {}
    for suite in report["suites"]:
        exact_keys(suite, {"evalId", "coverageDigest", "testPaths", "outcome", "passed", "failed", "skipped"}, "suite")
        eid = suite["evalId"]
        require(eid not in verified, "Duplicate test suite")
        if eid not in expected:
            continue
        require(suite["outcome"] == "passed" and integer(suite["passed"], "passed") > 0 and
                integer(suite["failed"], "failed", 0) == 0 and integer(suite["skipped"], "skipped", 0) == 0,
                "Required suite failed, empty, or skipped: " + eid)
        require(suite["coverageDigest"] == expected[eid]["coverageDigest"] and
                suite["testPaths"] == expected[eid]["testPaths"], "Suite coverage changed: " + eid)
        verified[eid] = {"runId": v["runId"], "attempt": v["runAttempt"], "verifierId": v["verifierId"],
                         "artifactId": v["artifactId"], "passed": suite["passed"]}
    return verified


def verify_reviews(payload: dict, expected: dict, catalog: dict, now: datetime) -> dict:
    require(isinstance(payload.get("reviews"), list) and len(payload["reviews"]) <= 200, "Malformed review list")
    result = {}
    for row in payload["reviews"]:
        exact_keys(row, {"evalId", "coverageDigest", "reviewedAt", "evidenceRef", "semanticReview"}, "eval review")
        eid = row["evalId"]
        require(eid not in result, "Duplicate eval review")
        if eid not in expected:
            continue
        require(row["coverageDigest"] == expected[eid]["coverageDigest"], "Review covers different suite: " + eid)
        stamp = dt(row["reviewedAt"])
        require(stamp <= dt(payload["issuedAt"]) <= now and
                0 <= (now - stamp).total_seconds() <= integer(catalog[eid]["reviewIntervalDays"], "review interval") * 86400,
                "Eval review missing, stale or future-dated: " + eid)
        require(row["semanticReview"] is True and isinstance(row["evidenceRef"], str) and 1 <= len(row["evidenceRef"]) <= 500,
                "Semantic review evidence missing: " + eid)
        result[eid] = {"reviewedAt": row["reviewedAt"], "signer": payload["keyId"], "evidenceRef": row["evidenceRef"]}
    return result


def evaluate(base_root: Path, candidate_root: Path, base_sha: str, head_sha: str, paths: list[str],
             envelopes: list[dict], api, now: datetime | None = None, signature_check=None, operational_paths=()) -> dict:
    now = now or datetime.now(timezone.utc)
    require(SHA.fullmatch(base_sha) is not None and SHA.fullmatch(head_sha) is not None, "Immutable SHAs required")
    policy_path = base_root / "governance/EVIDENCE_POLICY.json"
    policy = read_json(base_root, "governance/EVIDENCE_POLICY.json")
    require(policy["enabled"] is True and bool(policy["signers"]), "Evidence trust is not enrolled")
    plan = requirements(paths, base_root, candidate_root, operational_paths)
    expected = plan["expected"]
    require(isinstance(envelopes, list) and len(envelopes) <= policy["maxEvidenceRecords"], "Too many evidence records")
    tests, reviews, rejected = {}, {}, []
    checker = signature_check or verify_signature
    for envelope in envelopes:
        try:
            checker(envelope, policy_path)
            payload = envelope["payload"]
            common = {"purpose", "repository", "base", "head", "keyId", "issuedAt", "expiresAt"}
            expected_keys = common | ({"verification"} if payload["purpose"] == "test-verification" else {"reviews"})
            exact_keys(payload, expected_keys, "evidence payload")
            require(payload["repository"] == policy["repository"] and payload["base"] == base_sha and payload["head"] == head_sha,
                    "Evidence is not for this exact change")
            if payload["purpose"] == "test-verification":
                tests.update(verify_tests(payload, policy, api, expected, now))
            elif payload["purpose"] == "eval-review":
                reviews.update(verify_reviews(payload, expected, plan["catalog"], now))
            else:
                raise ValueError("Unrecognized evidence purpose")
        except (ValueError, KeyError, TypeError, zipfile.BadZipFile) as error:
            # Comments are untrusted. Invalid unrelated receipts cannot erase a valid one.
            rejected.append(type(error).__name__ + ": " + str(error)[:160])
    missing_tests = sorted(set(expected) - set(tests))
    missing_reviews = sorted(set(expected) - set(reviews))
    errors = []
    if missing_tests:
        errors.append("Missing authenticated successful test evidence: " + ", ".join(missing_tests))
    if missing_reviews:
        errors.append("Missing fresh signed exact-head eval review: " + ", ".join(missing_reviews))
    return {"passed": not errors, "errors": errors, "base": base_sha, "head": head_sha,
            "requiredEvals": sorted(expected), "affectedAreas": plan["affectedAreas"], "activationChecks": plan["activations"],
            "verifiedTests": tests, "verifiedReviews": reviews, "rejectedRecords": rejected,
            "scope": "Authenticated provenance and selected evidence freshness; not runtime or semantic certification"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--trusted-root", required=True, type=Path)
    parser.add_argument("--candidate-root", required=True, type=Path)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--base", required=True)
    parser.add_argument("--head", required=True)
    parser.add_argument("--evidence", required=True, type=Path)
    parser.add_argument("--plan-only", action="store_true")
    args = parser.parse_args()
    try:
        paths = changed_paths(args.repo, args.base, args.head)
        exempt = classify_operational(args.repo, args.base, args.head, args.trusted_root / "governance/TRUST_POLICY.json")
        if args.plan_only:
            plan = requirements(paths, args.trusted_root, args.candidate_root, exempt)
            print(json.dumps({"promotionAllowed": False, "auditOnly": True, "required": plan["expected"],
                              "affectedAreas": plan["affectedAreas"]}, indent=2))
            return 0
        api = GitHubAPI(os.environ.get("GH_TOKEN", ""))
        envelopes = strict_load(args.evidence.read_bytes())
        result = evaluate(args.trusted_root, args.candidate_root, args.base, args.head, paths, envelopes, api, operational_paths=exempt)
        print(json.dumps(result, indent=2))
        return 0 if result["passed"] else 2
    except Exception as error:
        print(json.dumps({"passed": False, "error": type(error).__name__ + ": " + str(error)[:200]}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
