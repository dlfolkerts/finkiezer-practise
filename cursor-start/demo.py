"""Demo module for file read, write, and append operations."""

DEFAULT_ENCODING = "utf-8"


def write_to_file(filename: str, text: str, encoding: str = DEFAULT_ENCODING) -> None:
    """Write text to a file, overwriting existing content."""
    try:
        with open(filename, "w", encoding=encoding) as file:
            file.write(text)
    except OSError as e:
        raise OSError(f"Failed to write to {filename}: {e}") from e


def read_from_file(filename: str, encoding: str = DEFAULT_ENCODING) -> str:
    """Read and return the entire contents of a file."""
    try:
        with open(filename, "r", encoding=encoding) as file:
            return file.read()
    except FileNotFoundError:
        raise FileNotFoundError(f"File not found: {filename}") from None
    except OSError as e:
        raise OSError(f"Failed to read from {filename}: {e}") from e


def append_to_file(
    filename: str, text: str, newline: bool = True, encoding: str = DEFAULT_ENCODING
) -> None:
    """Append text to a file. Optionally add a newline before the text."""
    try:
        with open(filename, "a", encoding=encoding) as file:
            if newline:
                file.write("\n")
            file.write(text)
    except OSError as e:
        raise OSError(f"Failed to append to {filename}: {e}") from e


def main() -> None:
    """Run a simple demo: write, read, then append and read again."""
    filename = input("Enter filename: ").strip() or "demo.txt"
    content = "Hello cursor"

    write_to_file(filename, content)
    print("Written. Contents:", read_from_file(filename))

    append_to_file(filename, content)
    print("Appended. Contents:", read_from_file(filename))


if __name__ == "__main__":
    main()
