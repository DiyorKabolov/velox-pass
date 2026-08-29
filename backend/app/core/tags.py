"""The fixed vocabulary of event tags.

One list, imported by both the schemas and the tag filter, so the values the API
accepts and the values it can be queried with cannot drift apart.
"""

EVENT_TAGS: tuple[str, ...] = (
    "кино",
    "опера",
    "театр",
    "концерт",
    "стендап",
    "митап",
    "выставка",
    "спорт",
    "фестиваль",
    "другое",
)

_ALLOWED = set(EVENT_TAGS)


def clean_tags(values: list[str] | None) -> list[str]:
    """Trim, drop blanks and duplicates, keep the vocabulary order.

    Ordering by the vocabulary rather than by the order they arrived in keeps
    the pills on a card in the same sequence everywhere, whatever order the
    admin happened to click them.
    """
    if not values:
        return []
    chosen = {str(value).strip().lower() for value in values if str(value).strip()}
    return [tag for tag in EVENT_TAGS if tag in chosen]


def unknown_tags(values: list[str] | None) -> list[str]:
    """The submitted tags that are not in the vocabulary."""
    if not values:
        return []
    return sorted(
        {
            str(value).strip()
            for value in values
            if str(value).strip() and str(value).strip().lower() not in _ALLOWED
        }
    )
