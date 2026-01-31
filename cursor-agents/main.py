from pathlib import Path

INPUTS_DIR = Path(__file__).resolve().parent / "inputs"


def find_and_load_md_files():
    if not INPUTS_DIR.is_dir():
        return []
    files = sorted(INPUTS_DIR.glob("*.md"))
    return [(p.stem, p.read_text(encoding="utf-8")) for p in files]


def main():
    items = find_and_load_md_files()
    print(f"Found {len(items)} .md file(s): {[stem for stem, _ in items]}")


if __name__ == "__main__":
    main()
