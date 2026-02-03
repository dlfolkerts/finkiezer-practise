import os
from pathlib import Path

from openai import OpenAI

INPUTS_DIR = Path(__file__).resolve().parent / "inputs"
OUTPUTS_DIR = Path(__file__).resolve().parent / "outputs"

X_POST_SYSTEM = (
    "You are a social media expert. Given the following content (raw text/markdown), "
    "write a single X (Twitter) post that captures the main idea, optimized for engagement "
    "and character limit. Create a highly engaging X post. Do not use # hashtags. "
    "Output only the post text, no preamble."
)


def find_and_load_md_files():
    if not INPUTS_DIR.is_dir():
        return []
    files = sorted(INPUTS_DIR.glob("*.md"))
    return [(p.stem, p.read_text(encoding="utf-8")) for p in files]


def generate_x_post(content: str) -> str:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model="gpt-5",
        messages=[
            {"role": "system", "content": X_POST_SYSTEM},
            {"role": "user", "content": content},
        ],
    )
    text = response.choices[0].message.content
    if not text:
        raise ValueError("OpenAI returned empty content")
    return text.strip()


def main():
    if not os.environ.get("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY is not set.")
        raise SystemExit(1)
    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    items = find_and_load_md_files()
    for stem, content in items:
        post = generate_x_post(content)
        out_path = OUTPUTS_DIR / f"{stem}.txt"
        out_path.write_text(post, encoding="utf-8")
        print(f"Processed: {stem} -> outputs/{stem}.txt")


if __name__ == "__main__":
    main()
