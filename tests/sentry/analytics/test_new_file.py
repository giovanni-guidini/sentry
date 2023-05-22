from sentry.analytics.new_file import pow


def test_pow():
    assert pow(1, 1) == 1
    assert pow(2, 3) == 8
