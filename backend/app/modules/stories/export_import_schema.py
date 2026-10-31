"""Regenerate the checked-in JSON Schema without database access."""
import json
from pathlib import Path

from app.modules.stories.import_schema import StoryImport


def official_schema() -> dict:
    schema = StoryImport.model_json_schema()
    schema['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
    schema['$id'] = 'urn:jardim-de-papel:story-import:1'
    schema['description'] = 'Contrato oficial de importacao editorial. Regras adicionais de ordem e colecao sao validadas pelo servidor.'
    return schema


if __name__ == '__main__':
    target = Path(__file__).resolve().parents[4] / 'docs/schemas/story-import-v1.schema.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(official_schema(), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
