"""The public repository, built on this computer from the list of allowed files (PLAN 9d). Nothing is pushed.

    python tools/public_repo.py               # release/public/: the files, the checks, a fresh git history
    python tools/public_repo.py --check-only  # list and check what would go in, without writing it
    python tools/public_repo.py --verify      # also check every chart and build it, in the copy

What goes in: the tracked files that tools/public-files.txt allows, and the pictures that the charts' media records
mark public, with their other forms (a portrait's source, an emblem's .svg). In Markdown, a block between <!-- private --> and <!-- /private --> is about this
working repository only and is left out.

The checks fail the build when anything gets in that must not:
  - a proprietary font: any font file outside assets/fonts/open/;
  - a non-free picture, the emblem or the logo: a file marked private in a chart, or a file with the same content
    under another name, or a picture under assets/ that no public media record names;
  - a private path: a local path (a drive's Users or Projects folder, a home folder, AppData, a Tailscale machine name);
  - a personal detail: this computer's git user name and email (read from git config here, so the check names no
    one), and anything listed in .scratch/personal.txt (untracked), one per line. The name may appear only in the
    licence files, as the copyright holder, and in the project's public addresses (`git config crownline.public`,
    space-separated, such as its GitHub repository and its Pages site), which are taken out of a line before it is
    read for personal details.
Text inside .gz fixtures is checked too. The first build makes a history of one commit, with no remote. Once the
copy is published, --keep-history builds it again over its own history (its .git is kept) and adds one commit, so a
release is pushed without rewriting what is public. The author is `git config crownline.author` ("Name <address>",
set in this repository only, so the address is in no file), or else the git user's name with no address.
"""
import argparse
import fnmatch
import gzip
import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIST = os.path.join(ROOT, "tools", "public-files.txt")
OUT = os.path.join(ROOT, "release", "public")
PICTURE_DIRS = ("assets/portraits/", "assets/portraits_src/", "assets/emblems/", "assets/brand/")
FONT_EXT = (".ttf", ".otf", ".woff", ".woff2", ".ttc")
TEXT_EXT = (".md", ".txt", ".json", ".py", ".ts", ".mjs", ".js", ".html", ".css", ".yml", ".yaml", ".toml", ".svg",
            ".geojson", ".cfg", ".ini", "")
NAME_ONLY_IN = {"LICENSE", "LICENSE-CONTENT.md"}
LOCAL_PATH = re.compile(r"(?i)\b[a-z]:[\\/]+(users|projects|documents and settings)\b|/home/[a-z]|/Users/[A-Za-z]"
                        r"|appdata[\\/]|\.ts\.net\b|/mnt/[a-z]/")
PRIVATE_BLOCK = re.compile(r"[ \t]*<!-- private -->.*?<!-- /private -->[ \t]*\n?", re.S)


def git(*args, cwd=ROOT, env=None):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, encoding="utf-8", env=env)
    if r.returncode:
        raise SystemExit(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def patterns():
    out = []
    with open(LIST, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                out.append((line.startswith("!"), line.lstrip("!")))
    return out


def matches(path, pat):
    if pat.endswith("/"):
        return path.startswith(pat)
    if "**" in pat:
        return fnmatch.fnmatch(path, pat.replace("**/", "*").replace("**", "*"))
    if "/" not in pat:                          # a name at the root only (*.py: the root's Python files)
        return "/" not in path and fnmatch.fnmatch(path, pat)
    return fnmatch.fnmatchcase(path, pat) and path.count("/") == pat.count("/")


def charts():
    for d in sorted(os.listdir(os.path.join(ROOT, "charts"))):
        p = os.path.join(ROOT, "charts", d, "chart.json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                yield d, json.load(f)


def media_files():
    """(public, private): repository paths of the pictures and data the charts name"""
    public, private = set(), set()
    for d, doc in charts():
        base = os.path.normpath(os.path.join("charts", d, doc["meta"].get("assetRoot", ".")))
        for m in doc.get("media", {}).values():
            p = os.path.normpath(os.path.join(base, m["file"])).replace("\\", "/")
            (private if m.get("private") else public).add(p)
    return public - private, private


def selection(tracked):
    """the files that go in, and why each picture under assets/ was left out"""
    public, private = media_files()
    # a public picture's other forms go with it: its source in portraits_src, an emblem's .svg beside its .png
    stems = {os.path.splitext(p)[0] for p in public if p.startswith(PICTURE_DIRS)}
    stems |= {s.replace("assets/portraits/", "assets/portraits_src/") for s in stems if s.startswith("assets/portraits/")}
    keep, left = [], {}
    pats = patterns()
    for f in tracked:
        if f.startswith(PICTURE_DIRS):
            if f in public:
                keep.append(f)
            elif os.path.splitext(f)[0] in stems or (f.startswith("assets/portraits_src/") and f.endswith("/crops.json")):
                keep.append(f)                # another form of a public picture, or a set's crops
            else:
                left[f] = "private" if f in private else "named by no public media record"
            continue
        ok = False
        for neg, pat in pats:
            if matches(f, pat):
                ok = not neg
        if ok:
            keep.append(f)
    return keep, left


def public_addresses():
    """the project's own public addresses, which may name its owner's account (lower case)"""
    r = subprocess.run(["git", "config", "crownline.public"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    return [a.lower() for a in r.stdout.split()]


def personal():
    """the strings that must not appear: this computer's git identity, and .scratch/personal.txt"""
    out = []
    for key in ("user.name", "user.email"):
        r = subprocess.run(["git", "config", key], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
        if r.stdout.strip():
            out.append(r.stdout.strip())
    name = out[0] if out else None
    if name and " " in name:
        out.append(name.split()[0])           # the first name alone
    extra = os.path.join(ROOT, ".scratch", "personal.txt")
    if os.path.exists(extra):
        with open(extra, encoding="utf-8") as f:
            out += [s.strip() for s in f if s.strip() and not s.startswith("#")]
    return [s for s in out if len(s) >= 3], name


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def text_of(path, rel):
    """a file's text for the checks, or None for a binary file (a .gz fixture is read inside)"""
    if rel.endswith(".gz"):
        with gzip.open(path, "rb") as f:
            data = f.read()
    elif os.path.splitext(rel)[1].lower() in TEXT_EXT or os.path.basename(rel).startswith("."):
        with open(path, "rb") as f:
            data = f.read()
    else:
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def strip_private(text):
    return PRIVATE_BLOCK.sub("", text)


def check(files, src_of, private_files):
    """the reasons the set may not be published (empty: it may)"""
    bad = []
    forbidden = {sha(os.path.join(ROOT, p)): p for p in private_files if os.path.exists(os.path.join(ROOT, p))}
    for f in os.listdir(os.path.join(ROOT, "assets", "fonts")):
        p = os.path.join(ROOT, "assets", "fonts", f)
        if os.path.isfile(p):
            forbidden[sha(p)] = f"assets/fonts/{f}"
    strings, name = personal()
    lowered, allowed = [(s, s.lower()) for s in strings], public_addresses()
    for rel in files:
        path = src_of(rel)
        if rel.lower().endswith(FONT_EXT) and not rel.startswith("assets/fonts/open/"):
            bad.append(f"{rel}: a font outside assets/fonts/open/")
        if rel.startswith("assets/fonts/") and not rel.startswith("assets/fonts/open/"):
            bad.append(f"{rel}: a proprietary font")
        h = sha(path)
        if h in forbidden:
            bad.append(f"{rel}: the same file as {forbidden[h]}, which may not be published")
        if re.search(r"(?i)fanmade|mangkualaman\.(png|jpg)", rel):
            bad.append(f"{rel}: the logo or the emblem")
        text = text_of(path, rel)
        if text is None:
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if LOCAL_PATH.search(line):
                bad.append(f"{rel}:{i}: a local path: {line.strip()[:100]}")
            low = line.lower()
            for addr in allowed:
                low = low.replace(addr, "")
            for s, sl in lowered:
                if sl not in low:
                    continue
                is_name = name is not None and s in (name, name.split()[0])
                if is_name and rel in NAME_ONLY_IN:
                    continue                     # the copyright holder, in the licence files
                bad.append(f"{rel}:{i}: a personal detail")
                break
    return bad


MD_LINK = re.compile(r"\]\(([^)\s#]+)(?:#[^)]*)?\)")


def broken_links(files, text_for):
    """relative Markdown links to files that are not in the set: they would be broken in the public repository"""
    have, bad = set(files), []
    for rel in files:
        if not rel.endswith(".md"):
            continue
        for i, line in enumerate(text_for(rel).splitlines(), 1):
            for target in MD_LINK.findall(line):
                if re.match(r"[a-z]+:", target) or target.startswith("/"):
                    continue                                 # a web address
                t = os.path.normpath(os.path.join(os.path.dirname(rel), target)).replace("\\", "/")
                if t not in have and not any(f.startswith(t.rstrip("/") + "/") for f in have):   # a file, or a folder
                    bad.append(f"{rel}:{i}: a link to {target}, which is not in the public repository")
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check-only", action="store_true", help="list and check, write nothing")
    ap.add_argument("--verify", action="store_true", help="also check and build every chart in the copy")
    ap.add_argument("--out", default=OUT, help="where to build it (default release/public)")
    ap.add_argument("--keep-history", action="store_true", help="build over the copy's own history and add a commit")
    ap.add_argument("--message", "-m", help="the commit's message (default: Crownline <version>)")
    a = ap.parse_args()
    sys.stdout.reconfigure(errors="replace")             # a console that cannot show every character the tests print

    tracked = [f for f in git("ls-files", "-z").split("\0") if f and os.path.exists(os.path.join(ROOT, f))]
    files, left = selection(tracked)
    _, private_files = media_files()
    out = os.path.abspath(a.out)
    print(f"{len(files)} of {len(tracked)} tracked files go in; {len(left)} pictures are left out")

    if a.check_only:
        bad = check(files, lambda r: os.path.join(ROOT, r), private_files)
        bad += broken_links(files, lambda r: strip_private(open(os.path.join(ROOT, r), encoding="utf-8").read()))
    else:
        if os.path.commonpath([out, ROOT]) == ROOT and not out.startswith(os.path.join(ROOT, "release")):
            raise SystemExit(f"{out}: build it under release/ or outside the repository")
        published = os.path.isdir(os.path.join(out, ".git")) and git("remote", cwd=out).strip()
        if published and not a.keep_history:
            raise SystemExit(f"{out} is published (it has a remote): build it with --keep-history, so its history stays")
        if a.keep_history and not os.path.isdir(os.path.join(out, ".git")):
            raise SystemExit(f"{out} has no history to keep: build it once without --keep-history")
        if os.path.exists(out):
            clear(out, keep_git=a.keep_history)
        for rel in files:
            dst = os.path.join(out, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if rel.endswith(".md"):
                with open(os.path.join(ROOT, rel), encoding="utf-8", newline="") as f:
                    text = f.read()
                with open(dst, "w", encoding="utf-8", newline="") as f:
                    f.write(strip_private(text))
            else:
                shutil.copy2(os.path.join(ROOT, rel), dst)
        bad = check(files, lambda r: os.path.join(out, r), private_files)
        bad += broken_links(files, lambda r: open(os.path.join(out, r), encoding="utf-8").read())

    for b in bad:
        print("  NOT PUBLISHABLE  " + b)
    if bad:
        print(f"{len(bad)} problems: nothing may be published like this")
        sys.exit(1)
    print("checks: no proprietary font, no private or unlisted picture, no local path, no personal detail")
    if a.check_only:
        return

    if a.verify:
        verify(out)
    name, address = author()
    env = dict(os.environ, GIT_AUTHOR_NAME=name, GIT_AUTHOR_EMAIL=address,
               GIT_COMMITTER_NAME=name, GIT_COMMITTER_EMAIL=address)
    if not a.keep_history:
        git("init", "-q", "-b", "main", cwd=out)
    git("add", "-A", cwd=out)
    if a.keep_history and not git("status", "--porcelain", cwd=out).strip():
        print(f"{out}: nothing changed since its last commit")
        return
    version = json.load(open(os.path.join(ROOT, "package.json"), encoding="utf-8")).get("version", "0.0.0")
    git("-c", "user.useConfigOnly=false", "commit", "-q", "-m", a.message or f"Crownline {version}", cwd=out, env=env)
    n, commits = len(git("ls-files", cwd=out).splitlines()), git("rev-list", "--count", "HEAD", cwd=out).strip()
    remote = git("remote", cwd=out).strip() or "no remote"
    print(f"wrote {out}: {n} files, {commits} commit(s), {remote}; author {name}")


def author():
    """the public commits' author: crownline.author from this repository's git config, else the user's name alone"""
    try:
        set_ = git("config", "--get", "crownline.author").strip()
    except SystemExit:                                   # not set: git config exits with 1
        set_ = ""
    m = re.fullmatch(r"(.+?)\s*<([^>]*)>", set_)
    if m:
        return m.group(1), m.group(2)
    _, name = personal()
    return name or "Crownline", ""


def clear(out, keep_git=False):
    """remove an earlier build (all but its .git, with keep_git). Refuses if a link is left in it (from a stopped
    --verify): removing the folder would reach through the link into its target. Git's object files are read-only,
    so they are made writable first"""
    for d, dirs, _ in os.walk(out):
        for x in dirs:
            at = os.path.join(d, x)
            if os.path.islink(at) or os.path.isjunction(at):
                raise SystemExit(f"{at} is a link: remove it with rmdir, then build again")

    def writable(fn, path, _):
        os.chmod(path, stat.S_IWRITE)
        fn(path)
    if not keep_git:
        shutil.rmtree(out, onexc=writable)
        return
    for e in os.listdir(out):
        if e != ".git":
            p = os.path.join(out, e)
            shutil.rmtree(p, onexc=writable) if os.path.isdir(p) else os.remove(p)


def link(target, at):
    """a directory link (a junction on Windows): removing it never touches its target"""
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "mklink", "/J", at, target], check=True, capture_output=True)
    else:
        os.symlink(target, at)


def unlink(at):
    if os.name == "nt":
        subprocess.run(["cmd", "/c", "rmdir", at], capture_output=True)       # the link only, never its target
    elif os.path.islink(at):
        os.unlink(at)


def verify(out):
    """check and build every chart in the copy, from its own files. The installed packages are linked, not copied;
    the workspace's own (@crownline/*) point at the copy's packages, so the copy runs its own code"""
    nm, links = os.path.join(out, "node_modules"), []
    os.makedirs(os.path.join(nm, "@crownline"))
    for e in os.listdir(os.path.join(ROOT, "node_modules")):
        if e != "@crownline":
            links.append(os.path.join(nm, e)); link(os.path.join(ROOT, "node_modules", e), links[-1])
    for e in os.listdir(os.path.join(out, "packages")):
        links.append(os.path.join(nm, "@crownline", e)); link(os.path.join(out, "packages", e), links[-1])
        own = os.path.join(ROOT, "packages", e, "node_modules")
        if os.path.isdir(own):
            links.append(os.path.join(out, "packages", e, "node_modules")); link(own, links[-1])
    try:
        # the charts, checked and built against their locks; then the tests, as the public repository's CI runs them
        tests = [(f"packages/{p}", ["node", "--import", "tsx", "--test", "tests/*.test.ts"]) for p in ("schema", "engine", "ops", "cli")]
        for where, cmd in (("", ["node", "--import", "tsx", "packages/schema/src/cli.ts", "check"]),
                           *[("", ["node", "--import", "tsx", "packages/engine/src/cli.ts", f"charts/{d}/chart.json", w, "--lock",
                                   "--out", f"release-check-{d}{w}"]) for d, _ in charts() for w in ("", "--public")],
                           *tests, ("", [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider"])):
            cmd = [c for c in cmd if c]
            env = {k: v for k, v in os.environ.items() if k != "INIT_CWD"}   # npm's: it would point back here
            r = subprocess.run(cmd, cwd=os.path.join(out, where), capture_output=True, text=True, encoding="utf-8", env=env)
            lines = (r.stdout + r.stderr).strip().splitlines()
            tail = [x for x in lines if x.startswith(("ℹ pass", "ℹ fail"))] or lines[-1:] or [""]
            what = where or " ".join(cmd[3:] if cmd[0] == "node" and "--test" not in cmd else cmd[1:])
            print(f"  {'ok' if r.returncode == 0 else 'FAILED'}  {what}: {', '.join(t.strip() for t in tail)[-110:]}")
            if r.returncode:
                raise SystemExit("the copy does not build as it should")
    finally:
        for at in links:
            unlink(at)
        stuck = [at for at in links if os.path.lexists(at)]
        if stuck:                                        # never delete through a link that is still there
            print(f"  left in place: {len(stuck)} links under {nm}; remove them with rmdir")
        else:
            shutil.rmtree(nm, ignore_errors=True)        # only the emptied folders are left
        for f in os.listdir(out):
            if f.startswith("release-check-"):
                os.remove(os.path.join(out, f))


if __name__ == "__main__":
    main()
