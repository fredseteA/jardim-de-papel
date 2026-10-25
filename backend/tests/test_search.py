from types import SimpleNamespace

import pytest

from app.api.v1.router import matches_query


@pytest.mark.parametrize('query', ['chapeusinho', 'chapeuzinho vermelo', 'vermelho chapeuzinho', 'classicos'])
def test_search_matches_text_and_category(query):
    story = SimpleNamespace(title='Chapeuzinho Vermelho', description='Uma floresta', synopsis='Uma aventura')
    assert matches_query(story, query, 'Contos Clássicos')


def test_search_rejects_unrelated_tokens():
    story = SimpleNamespace(title='Chapeuzinho Vermelho', description='', synopsis='')
    assert not matches_query(story, 'xyzxyz', 'Contos Clássicos')
