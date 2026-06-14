# Dataset Schema

## `authors.jsonl`

```json
{
  "id": "author_bangla_slug_or_hash",
  "name_bn": "বাংলা নাম",
  "name_en": "English transliteration",
  "aliases": ["alternate spelling"],
  "birth_year": null,
  "death_year": null,
  "country_or_region": null,
  "notes": null,
  "source_refs": ["source_rokomari_123"],
  "confidence": 0.0
}
```

## `works/`

Works are stored as paged JSONL under `main/works/`, listed by `main/works/manifest.json`. Scripts should access them through the logical `works.jsonl` path and `dataset/scripts/jsonl-store.js`.

```json
{
  "id": "work_bangla_slug_or_hash",
  "title_bn": "বাংলা বইয়ের নাম",
  "title_en": "English title/transliteration",
  "aliases": [],
  "language": "bn",
  "genre": null,
  "first_published_year": null,
  "source_refs": ["source_rokomari_book_123"],
  "confidence": 0.0
}
```

## `editions/`

Editions are stored as paged JSONL under `main/editions/`, listed by `main/editions/manifest.json`.

```json
{
  "id": "edition_source_or_hash",
  "work_id": "work_bangla_slug_or_hash",
  "title_as_printed": "Printed title",
  "publisher": null,
  "publication_year": null,
  "isbn": null,
  "pages": null,
  "format": null,
  "source_refs": ["source_books_com_bd_123"],
  "confidence": 0.0
}
```

## `contributions/`

Contributions are stored as paged JSONL under `main/contributions/`, listed by `main/contributions/manifest.json`.

```json
{
  "id": "contribution_hash",
  "work_id": "work_bangla_slug_or_hash",
  "edition_id": null,
  "author_id": "author_bangla_slug_or_hash",
  "role": "author",
  "source_refs": ["source_123"],
  "confidence": 0.0
}
```

Allowed roles should include `author`, `editor`, `translator`, `adapter`, `compiler`, `illustrator`, and `unknown`.

## `source_records/`

Source records are paged JSONL files under `main/source_records/`, listed by `main/source_records/manifest.json`.

```json
{
  "id": "source_rokomari_123",
  "source": "rokomaribg",
  "url": null,
  "retrieved_at": "2026-05-21",
  "raw_path": "archive/rokomaribg/file.json",
  "external_id": null,
  "record_type": "book",
  "raw_title": null,
  "raw_author": null,
  "notes": null
}
```
