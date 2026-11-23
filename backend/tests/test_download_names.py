from urllib.parse import unquote

import pytest

from backend.app.exporter import export_disposition


@pytest.mark.parametrize('title, expected', [
    ('Révision: équipe / tâches', 'Révision- équipe - tâches'),
    ('..\\outside\r\n"report"', '-outside---report-'),
    ('CON', '_CON'),
    ('  ...  ', 'SOP'),
])
def test_export_names_are_readable_unicode_and_safe_on_windows(title, expected):
    for extension in ('pdf', 'docx'):
        header = export_disposition(title, extension)
        header.encode('ascii')
        assert '\r' not in header and '\n' not in header
        filename = unquote(header.split("filename*=UTF-8''")[1])
        assert filename == f'{expected}.{extension}'
