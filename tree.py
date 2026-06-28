import os
from pathlib import Path


def generate_tree(root_path: str, output_file: str = "directory_tree.txt"):
    root = Path(root_path)

    if not root.exists():
        raise FileNotFoundError(f"Path does not exist: {root_path}")

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"{root.name}\n")

        def walk(directory: Path, prefix: str = ""):
            items = sorted(
                directory.iterdir(),
                key=lambda x: (x.is_file(), x.name.lower())
            )

            for index, item in enumerate(items):
                is_last = index == len(items) - 1

                connector = "└── " if is_last else "├── "
                f.write(f"{prefix}{connector}{item.name}\n")

                if item.is_dir():
                    extension = "    " if is_last else "│   "
                    walk(item, prefix + extension)

        walk(root)

    print(f"Directory tree saved to: {output_file}")


if __name__ == "__main__":
    # Current directory
    generate_tree(".", "project_tree.txt")

    # Example for any directory:
    # generate_tree("/Users/ujjwal/projects/vayy", "vayy_tree.txt")