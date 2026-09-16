def _assert_body(actual, expected):
    """Subset match per the django-testing skill, extended for our bare-array
    list endpoints (no envelope/pagination):

    - actual is a dict: check only the declared keys (skip a None value).
    - actual is a list and expected is a list: exact match (e.g. `[]` to
      assert an empty result set).
    - actual is a list and expected is a dict: an optional "__count__" key
      checks len(actual); any other keys are checked against actual[0].
    """
    if expected is None:
        return
    if isinstance(actual, list):
        if isinstance(expected, list):
            assert actual == expected
            return
        expected = dict(expected)
        count = expected.pop("__count__", None)
        if count is not None:
            assert len(actual) == count
        if expected:
            assert actual, "expected at least one item to check keys against"
            for key, value in expected.items():
                if value is not None:
                    assert actual[0][key] == value
        return
    for key, value in expected.items():
        if value is None:
            continue
        if isinstance(value, dict):
            _assert_body(actual[key], value)
        else:
            assert actual[key] == value


def test_api_case(api, db, placeholders, substitute, case):
    endpoint = substitute(case["endpoint"], placeholders)
    headers = substitute(case["headers"], placeholders)
    payload = substitute(case["payload"], placeholders)
    query_params = substitute(case.get("query_params", {}), placeholders)
    expected_body = substitute(case["expected_body"], placeholders)

    response = api.request(
        case["method"], endpoint, json_body=payload, headers=headers, params=query_params
    )

    assert response.status_code == case["expected_status"], response.content
    if expected_body is not None:
        _assert_body(response.json(), expected_body)
